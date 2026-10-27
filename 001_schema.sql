-- BillBored backend schema (Supabase / Postgres). Amounts are stored in kobo (₦1 = 100 kobo).
create extension if not exists pgcrypto;

create type user_role   as enum ('user','supporter','reviewer','partner','admin');
create type bill_status as enum ('submitted','under_review','more_info','eligible','partially_supported','cleared','declined');
create type ledger_kind as enum ('pledged','received','allocated','verified_paid','refunded');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  handle text unique not null check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null,
  role user_role not null default 'user',
  created_at timestamptz not null default now()
);

-- Public figures stay "unclaimed" until the person (or their team) proves authorization.
create table figures (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  tagline text,
  category text not null,
  claimed_by uuid references profiles(id),
  authorized boolean not null default false
);

create table follows (
  user_id uuid references profiles(id) on delete cascade,
  figure_id uuid references figures(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, figure_id)
);
create view figure_stats as
  select f.id as figure_id, count(fo.user_id) as followers from figures f
  left join follows fo on fo.figure_id = f.id group by f.id;

-- Private record. Never exposed directly to the public.
create table bills (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles(id),
  category text not null check (category in ('Education','Housing','Utilities','Water','Healthcare','Other')),
  amount_kobo bigint not null check (amount_kobo > 0),
  description text not null check (char_length(description) between 10 and 1000),
  biller_name text not null,
  biller_account_ref text not null,          -- school / DISCO / hospital account, paid directly
  due_date date,
  status bill_status not null default 'submitted',
  public_title text,                         -- written by a reviewer, redacted
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table bill_documents (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references bills(id) on delete cascade,
  storage_path text not null,                -- private bucket 'bill-evidence', signed URLs only
  uploaded_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table ledger_entries (                -- append-only
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references bills(id),
  kind ledger_kind not null,
  amount_kobo bigint not null check (amount_kobo > 0),
  supporter_id uuid references profiles(id),
  anonymous boolean not null default false,
  provider_ref text unique,                  -- Paystack/Flutterwave reference: blocks double-counting
  created_at timestamptz not null default now()
);
create function ledger_immutable() returns trigger language plpgsql as
$$ begin raise exception 'ledger_entries is append-only'; end $$;
create trigger ledger_no_edit before update or delete on ledger_entries
  for each row execute function ledger_immutable();

create table cheers (
  bill_id uuid references bills(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  kind text not null check (kind in ('hold_on','god_dey','almost_there')),
  primary key (bill_id, user_id, kind)
);

create table audit_log (
  id bigserial primary key,
  actor_id uuid references profiles(id),
  action text not null,
  bill_id uuid references bills(id),
  note text,
  created_at timestamptz not null default now()
);

-- Public cards: only reviewed bills, only redacted fields.
create view public_bills as
  select b.id, b.category, b.public_title as title, b.amount_kobo as target_kobo, b.due_date, b.status,
    coalesce(sum(l.amount_kobo) filter (where l.kind='pledged'),0)       as pledged_kobo,
    coalesce(sum(l.amount_kobo) filter (where l.kind='received'),0)      as received_kobo,
    coalesce(sum(l.amount_kobo) filter (where l.kind='verified_paid'),0) as verified_paid_kobo
  from bills b left join ledger_entries l on l.bill_id = b.id
  where b.status in ('eligible','partially_supported','cleared') and b.public_title is not null
  group by b.id;

-- Row-level security
create function is_staff() returns boolean language sql stable as
$$ select exists(select 1 from profiles where id = auth.uid() and role in ('reviewer','admin')) $$;

alter table profiles enable row level security;
alter table figures enable row level security;
alter table follows enable row level security;
alter table bills enable row level security;
alter table bill_documents enable row level security;
alter table ledger_entries enable row level security;
alter table cheers enable row level security;
alter table audit_log enable row level security;

create policy "profiles readable" on profiles for select using (true);
create policy "own profile edit" on profiles for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()));
create policy "figures readable" on figures for select using (true);
create policy "follow self" on follows for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own bills read" on bills for select using (requester_id = auth.uid() or is_staff());
create policy "submit own bill" on bills for insert with check (requester_id = auth.uid() and status = 'submitted');
create policy "staff update bills" on bills for update using (is_staff());
create policy "own docs" on bill_documents for select
  using (is_staff() or exists(select 1 from bills b where b.id = bill_id and b.requester_id = auth.uid()));
create policy "upload own docs" on bill_documents for insert with check (uploaded_by = auth.uid());
create policy "ledger staff read" on ledger_entries for select using (is_staff());  -- writes come from the payment webhook (service role)
create policy "cheer self" on cheers for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "audit staff" on audit_log for select using (is_staff());

grant select on public_bills, figure_stats to anon, authenticated;

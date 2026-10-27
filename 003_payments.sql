-- Run after 002. Payment attempts; the ledger only gets a 'received' row after Paystack confirms.
create type payment_status as enum ('pending','success','failed');
create table payments (
  reference text primary key,
  bill_id uuid not null references bills(id),
  supporter_id uuid not null references profiles(id),
  amount_kobo bigint not null check (amount_kobo >= 10000),   -- minimum ₦100
  anonymous boolean not null default false,
  status payment_status not null default 'pending',
  created_at timestamptz not null default now()
);
alter table payments enable row level security;
create policy "own payments" on payments for select using (supporter_id = auth.uid() or is_staff());
-- No insert/update policies: only the Edge Functions (service role) write here.

-- Anonymous-safe feed of real support, for the "Just happened" list.
create view recent_support as
  select l.id, l.bill_id, b.category, l.amount_kobo, l.created_at,
         case when l.anonymous then null else p.display_name end as supporter_name
  from ledger_entries l
  join bills b on b.id = l.bill_id
  left join profiles p on p.id = l.supporter_id
  where l.kind = 'received'
  order by l.created_at desc limit 10;
grant select on recent_support to anon, authenticated;

-- Run after 006. Figure profile pages, the claim flow, and real impact numbers. No email involved: notifications stay in-app.
alter table figures add column bio text check (char_length(bio) <= 600);

create table figure_claims (
  id uuid primary key default gen_random_uuid(),
  figure_id uuid not null references figures(id),
  claimant_id uuid not null references profiles(id),
  role_title text not null check (char_length(role_title) between 2 and 80),
  proof_note text not null check (char_length(proof_note) between 20 and 1000),
  proof_path text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create unique index one_pending_claim on figure_claims (figure_id, claimant_id) where status = 'pending';
alter table figure_claims enable row level security;
create policy "own or staff claims" on figure_claims for select using (claimant_id = auth.uid() or is_staff());
create policy "submit claim" on figure_claims for insert with check (
  claimant_id = auth.uid() and status = 'pending'
  and exists (select 1 from figures f where f.id = figure_id and f.claimed_by is null));

insert into storage.buckets (id, name, public) values ('claim-proof', 'claim-proof', false) on conflict do nothing;
create policy "upload own claim proof" on storage.objects for insert to authenticated
  with check (bucket_id = 'claim-proof' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "read own or staff claim proof" on storage.objects for select to authenticated
  using (bucket_id = 'claim-proof' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));

create function public.review_claim(p_claim uuid, p_approve boolean, p_note text) returns void language plpgsql security definer set search_path = public as
$$ declare c figure_claims%rowtype; nm text;
begin
  if not is_staff() then raise exception 'Reviewers only'; end if;
  select * into c from figure_claims where id = p_claim and status = 'pending' for update;
  if not found then raise exception 'Claim not found or already reviewed'; end if;
  select name into nm from figures where id = c.figure_id;
  if p_approve then
    if exists (select 1 from figures where id = c.figure_id and claimed_by is not null) then raise exception 'Already claimed'; end if;
    update figures set claimed_by = c.claimant_id, authorized = true where id = c.figure_id;
    update profiles set role = 'partner' where id = c.claimant_id and role = 'user';
    update figure_claims set status = 'approved', reviewed_by = auth.uid() where id = p_claim;
    perform push_notification(c.claimant_id, 'claim', 'Your request for ' || nm || ' was approved. You can now post Official updates and edit the About section.');
  else
    update figure_claims set status = 'rejected', reviewed_by = auth.uid() where id = p_claim;
    perform push_notification(c.claimant_id, 'claim', 'Your request for ' || nm || ' wasn''t approved.' || coalesce(' Note: ' || p_note, ''));
  end if;
  insert into audit_log (actor_id, action, note) values (auth.uid(), 'claim:' || case when p_approve then 'approved' else 'rejected' end, p_claim::text);
end $$;

create function public.update_figure_bio(p_figure uuid, p_bio text) returns void language plpgsql security definer set search_path = public as
$$ begin
  if not exists (select 1 from figures where id = p_figure and claimed_by = auth.uid() and authorized) then
    raise exception 'Only the approved team can edit this'; end if;
  update figures set bio = nullif(trim(p_bio), '') where id = p_figure;
end $$;
revoke all on function public.review_claim, public.update_figure_bio from public;
grant execute on function public.review_claim, public.update_figure_bio to authenticated;

-- Real impact: only money given publicly by the figure's own approved account.
create view figure_impact as
  select f.id as figure_id, count(distinct l.bill_id) as bills_backed, coalesce(sum(l.amount_kobo), 0) as total_kobo
  from figures f
  left join ledger_entries l on f.authorized and l.supporter_id = f.claimed_by and l.kind = 'received' and not l.anonymous
  group by f.id;
create view figure_backed_bills as
  select distinct f.id as figure_id, pb.id as bill_id, pb.category, pb.title, pb.target_kobo, pb.received_kobo, pb.status
  from figures f
  join ledger_entries l on l.supporter_id = f.claimed_by and l.kind = 'received' and not l.anonymous
  join public_bills pb on pb.id = l.bill_id
  where f.authorized;
grant select on figure_impact, figure_backed_bills to anon, authenticated;

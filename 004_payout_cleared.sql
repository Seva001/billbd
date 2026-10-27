-- Run after 003. Reviewers record the biller payout with a receipt; the bill clears only when verified payouts reach the target.
alter table bills add column cleared_at timestamptz;

create table payouts (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references bills(id),
  amount_kobo bigint not null check (amount_kobo > 0),
  reference text not null unique,
  receipt_path text not null,
  paid_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);
alter table payouts enable row level security;

create function public.can_see_receipt(p_bill uuid) returns boolean language sql stable security definer set search_path = public as
$$ select is_staff()
   or exists (select 1 from bills b where b.id = p_bill and b.requester_id = auth.uid())
   or exists (select 1 from ledger_entries l where l.bill_id = p_bill and l.kind = 'received' and l.supporter_id = auth.uid()) $$;
create policy "receipt viewers" on payouts for select using (can_see_receipt(bill_id));

insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false) on conflict do nothing;
create policy "staff upload receipts" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and public.is_staff());
create policy "receipt viewers read" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and public.can_see_receipt(((storage.foldername(name))[1])::uuid));

create function public.record_payout(p_bill uuid, p_amount bigint, p_reference text, p_receipt text)
returns void language plpgsql security definer set search_path = public as
$$
declare tgt bigint; got bigint; paid bigint; st bill_status;
begin
  if not is_staff() then raise exception 'Reviewers only'; end if;
  if char_length(trim(p_reference)) < 4 then raise exception 'Payment reference required'; end if;
  if p_receipt is null or p_receipt not like p_bill::text || '/%' then raise exception 'Receipt required'; end if;
  select amount_kobo, status into tgt, st from bills where id = p_bill for update;
  if st not in ('eligible', 'partially_supported') then raise exception 'Bill is not open for payout'; end if;
  select coalesce(sum(amount_kobo) filter (where kind = 'received'), 0),
         coalesce(sum(amount_kobo) filter (where kind = 'verified_paid'), 0)
    into got, paid from ledger_entries where bill_id = p_bill;
  if p_amount <= 0 or p_amount > got - paid then raise exception 'Amount exceeds money available for payout'; end if;
  insert into payouts (bill_id, amount_kobo, reference, receipt_path, paid_by)
    values (p_bill, p_amount, trim(p_reference), p_receipt, auth.uid());
  insert into ledger_entries (bill_id, kind, amount_kobo, provider_ref)
    values (p_bill, 'verified_paid', p_amount, 'payout:' || trim(p_reference));
  if paid + p_amount >= tgt then update bills set status = 'cleared', cleared_at = now() where id = p_bill; end if;
  insert into audit_log (actor_id, action, bill_id, note) values (auth.uid(), 'payout', p_bill, trim(p_reference));
end $$;
revoke all on function public.record_payout from public;
grant execute on function public.record_payout to authenticated;

-- Anonymous thank-you from the person whose bill was cleared.
create table thank_yous (
  bill_id uuid primary key references bills(id) on delete cascade,
  message text not null check (char_length(message) between 3 and 280),
  created_at timestamptz not null default now()
);
alter table thank_yous enable row level security;
create policy "thanks public read" on thank_yous for select using (true);
create policy "staff remove thanks" on thank_yous for delete using (is_staff());
create function public.add_thank_you(p_bill uuid, p_msg text) returns void language plpgsql security definer set search_path = public as
$$ begin
  if not exists (select 1 from bills where id = p_bill and requester_id = auth.uid() and status = 'cleared') then
    raise exception 'Only the person whose bill was cleared can say thanks'; end if;
  insert into thank_yous (bill_id, message) values (p_bill, trim(p_msg))
    on conflict (bill_id) do update set message = excluded.message;
end $$;
grant execute on function public.add_thank_you to authenticated;

create view cleared_wall as
  select b.id, b.category, b.public_title as title, b.amount_kobo as target_kobo, b.cleared_at, t.message,
         (select count(distinct l.supporter_id) from ledger_entries l where l.bill_id = b.id and l.kind = 'received') as supporters
  from bills b left join thank_yous t on t.bill_id = b.id
  where b.status = 'cleared' order by b.cleared_at desc;
grant select on cleared_wall to anon, authenticated;

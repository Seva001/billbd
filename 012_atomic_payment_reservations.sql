-- Atomic payment reservation. Run after 003_payments.sql.
-- A row lock on bills serializes concurrent checkout attempts for the same bill.
create or replace function reserve_bill_payment(
  p_bill_id uuid,
  p_supporter_id uuid,
  p_amount_kobo bigint,
  p_reference text,
  p_anonymous boolean default false
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bill bills%rowtype;
  v_received bigint;
  v_pending bigint;
  v_remaining bigint;
begin
  if p_amount_kobo is null or p_amount_kobo < 10000 then
    raise exception 'Minimum contribution is 10000 kobo';
  end if;
  if p_reference is null or length(p_reference) < 8 then
    raise exception 'Invalid payment reference';
  end if;

  select * into v_bill from bills where id = p_bill_id for update;
  if not found or v_bill.status not in ('eligible', 'partially_supported') or v_bill.public_title is null then
    raise exception 'This bill is not open for support';
  end if;

  select coalesce(sum(amount_kobo), 0) into v_received
    from ledger_entries where bill_id = p_bill_id and kind = 'received';
  select coalesce(sum(amount_kobo), 0) into v_pending
    from payments where bill_id = p_bill_id and status = 'pending';

  v_remaining := v_bill.amount_kobo - v_received - v_pending;
  if v_remaining <= 0 or p_amount_kobo > v_remaining then
    raise exception 'Contribution exceeds the remaining amount';
  end if;

  insert into payments(reference, bill_id, supporter_id, amount_kobo, anonymous, status)
    values (p_reference, p_bill_id, p_supporter_id, p_amount_kobo, coalesce(p_anonymous, false), 'pending');
  return v_remaining - p_amount_kobo;
end;
$$;

revoke all on function reserve_bill_payment(uuid, uuid, bigint, text, boolean) from public, anon, authenticated;
grant execute on function reserve_bill_payment(uuid, uuid, bigint, text, boolean) to service_role;

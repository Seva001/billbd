-- Run after 001_schema.sql.
-- 1) Create a profile automatically when someone signs up by email.
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as
$$ begin
  insert into profiles (id, handle, display_name)
  values (new.id, 'user_' || substr(replace(new.id::text, '-', ''), 1, 10), split_part(new.email, '@', 1));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- 2) Private bucket for bill documents.
insert into storage.buckets (id, name, public) values ('bill-evidence', 'bill-evidence', false) on conflict do nothing;
create policy "upload own evidence" on storage.objects for insert to authenticated
  with check (bucket_id = 'bill-evidence' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "read own or staff evidence" on storage.objects for select to authenticated
  using (bucket_id = 'bill-evidence' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));

-- 3) Reviewers change status only through this function, which also writes the audit log.
create function public.review_bill(p_bill uuid, p_status bill_status, p_title text, p_note text)
returns void language plpgsql security definer set search_path = public as
$$ begin
  if not is_staff() then raise exception 'Reviewers only'; end if;
  if p_status not in ('under_review','more_info','eligible','declined') then raise exception 'Status not allowed here'; end if;
  if p_status = 'eligible' and (p_title is null or char_length(trim(p_title)) < 10) then raise exception 'Public title required'; end if;
  update bills set status = p_status,
    public_title = case when p_status = 'eligible' then trim(p_title) else public_title end,
    published_at = case when p_status = 'eligible' then now() else published_at end
  where id = p_bill;
  insert into audit_log (actor_id, action, bill_id, note) values (auth.uid(), 'status:' || p_status, p_bill, p_note);
end $$;
revoke all on function public.review_bill from public;
grant execute on function public.review_bill to authenticated;

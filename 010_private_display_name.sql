-- Run after 009. Stops the first part of a person's email from becoming their public display name.
-- Profiles are readable by everyone, so a default name like "dayo.adeyemi" (from dayo.adeyemi@gmail.com) leaked part of the email.

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as
$$
declare h text := 'user_' || substr(replace(new.id::text, '-', ''), 1, 10);
begin
  insert into profiles (id, handle, display_name)
  values (new.id, h, 'Member ' || substr(replace(new.id::text, '-', ''), 1, 4));
  return new;
end $$;

-- Fix people who already signed up and never changed their name.
update profiles p
set display_name = 'Member ' || substr(replace(p.id::text, '-', ''), 1, 4)
from auth.users u
where u.id = p.id
  and p.display_name = split_part(u.email, '@', 1);

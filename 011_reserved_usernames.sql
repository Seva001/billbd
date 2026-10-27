-- Run after 010. Reserves usernames so nobody can pose as a public figure or as BillBored staff.
-- The rule lives in the database, so it cannot be skipped by editing the app.
-- Names come from the figures table, so figures you add later are protected automatically.

create or replace function public.norm_name(t text) returns text language sql immutable as
$$ select regexp_replace(lower(coalesce(t, '')), '[^a-z]', '', 'g') $$;

create or replace function public.guard_reserved_names() returns trigger language plpgsql security definer set search_path = public as
$$
declare
  cand text[] := array[public.norm_name(new.handle), public.norm_name(new.display_name)];
  c text; f record; tok text; toks text[]; last_tok text; full_name text;
begin
  -- Reviewers and admins may use platform names.
  if coalesce((select role::text from profiles where id = new.id), 'user') in ('admin', 'reviewer') then return new; end if;

  foreach c in array cand loop
    if c = '' then continue; end if;

    -- Platform words
    if c like '%billbored%' or c like '%official%'
       or c in ('admin', 'administrator', 'support', 'moderator', 'mod', 'staff', 'help', 'team', 'system', 'owner', 'reviewer') then
      raise exception 'That username is reserved.' using errcode = 'P0001';
    end if;

    -- Public figures
    for f in select name, claimed_by from figures loop
      -- A verified figure (or their team) may use their own name.
      if f.claimed_by is not null and f.claimed_by = new.id then continue; end if;

      full_name := public.norm_name(f.name);
      toks := array(select t from unnest(regexp_split_to_array(lower(f.name), '[^a-z]+')) t where t <> '');
      last_tok := toks[array_length(toks, 1)];

      if full_name <> '' and position(full_name in c) > 0 then
        raise exception 'That username is reserved.' using errcode = 'P0001';
      end if;
      foreach tok in array toks loop
        if length(tok) >= 5 and c = tok then
          raise exception 'That username is reserved.' using errcode = 'P0001';
        end if;
      end loop;
      if last_tok is not null and length(last_tok) >= 7 and position(last_tok in c) > 0 then
        raise exception 'That username is reserved.' using errcode = 'P0001';
      end if;
    end loop;
  end loop;
  return new;
end $$;

drop trigger if exists guard_reserved_names on profiles;
create trigger guard_reserved_names before insert or update of handle, display_name on profiles
  for each row execute function public.guard_reserved_names();

-- Review step: lists existing accounts that already use a reserved-looking name.
-- Check them by hand (a real fan may be fine, an impersonator is not), then rename or remove.
-- select p.handle, p.display_name, p.id from profiles p
-- join figures f on public.norm_name(p.handle) like '%' || public.norm_name(f.name) || '%'
-- where f.claimed_by is distinct from p.id;

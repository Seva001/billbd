-- Run after 005. Moderation queue, replies, likes, notifications.

-- 1) Muting. Users must not be able to clear their own mute, so tighten the profile-edit policy.
alter table profiles add column muted_until timestamptz;
drop policy "own profile edit" on profiles;
create policy "own profile edit" on profiles for update using (id = auth.uid())
  with check (id = auth.uid()
    and role = (select role from profiles where id = auth.uid())
    and muted_until is not distinct from (select muted_until from profiles where id = auth.uid()));

-- 2) Replies (one level deep) and likes.
alter table posts add column parent_id uuid references posts(id) on delete cascade;
create table post_likes (
  post_id uuid references posts(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table post_likes enable row level security;
create policy "see own likes" on post_likes for select using (user_id = auth.uid());
create policy "like as self" on post_likes for insert with check (user_id = auth.uid());
create policy "unlike as self" on post_likes for delete using (user_id = auth.uid());

create or replace function public.posts_guard() returns trigger language plpgsql as
$$ begin
  if exists (select 1 from profiles where id = new.author_id and muted_until > now()) then
    raise exception 'muted';
  end if;
  if new.parent_id is not null and not exists (
      select 1 from posts p where p.id = new.parent_id and p.community_id = new.community_id and p.parent_id is null) then
    raise exception 'Replies go under a post in the same community';
  end if;
  new.official := exists (select 1 from communities c join figures f on f.id = c.figure_id
                          where c.id = new.community_id and f.authorized and f.claimed_by = new.author_id);
  if (select count(*) from posts where author_id = new.author_id and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'rate limit: too many posts';
  end if;
  return new;
end $$;

create or replace view community_feed as
  select p.id, p.community_id, p.body, p.official, p.created_at, p.author_id, pr.handle as author_handle,
         p.parent_id,
         (select count(*) from post_likes l where l.post_id = p.id) as like_count,
         (select count(*) from posts c where c.parent_id = p.id) as reply_count
  from posts p join profiles pr on pr.id = p.author_id
  where (select count(*) from post_reports r where r.post_id = p.id) < 3;

-- 3) Moderation queue (reviewers only, enforced inside the functions).
create function public.moderation_queue()
returns table (post_id uuid, community_name text, author_handle text, body text, reports bigint, created_at timestamptz)
language sql stable security definer set search_path = public as
$$ select p.id, c.name, pr.handle, p.body, count(r.reporter_id), p.created_at
   from posts p
   join post_reports r on r.post_id = p.id
   join communities c on c.id = p.community_id
   join profiles pr on pr.id = p.author_id
   where is_staff()
   group by p.id, c.name, pr.handle
   order by count(r.reporter_id) desc, p.created_at $$;

create function public.moderate_post(p_post uuid, p_action text) returns void language plpgsql security definer set search_path = public as
$$ declare a uuid;
begin
  if not is_staff() then raise exception 'Reviewers only'; end if;
  select author_id into a from posts where id = p_post;
  if p_action = 'dismiss' then
    delete from post_reports where post_id = p_post;
  elsif p_action in ('remove', 'remove_mute') then
    if p_action = 'remove_mute' then update profiles set muted_until = now() + interval '7 days' where id = a; end if;
    delete from posts where id = p_post;
  else
    raise exception 'Unknown action';
  end if;
  insert into audit_log (actor_id, action, note) values (auth.uid(), 'post:' || p_action, p_post::text);
end $$;
revoke all on function public.moderation_queue, public.moderate_post from public;
grant execute on function public.moderation_queue, public.moderate_post to authenticated;

-- 4) Notifications. Only triggers create them; users can only mark their own as read.
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index on notifications (user_id, created_at desc);
alter table notifications enable row level security;
create policy "own notifications" on notifications for select using (user_id = auth.uid());
create policy "mark own read" on notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on notifications from authenticated;
grant update (read) on notifications to authenticated;

create function public.push_notification(p_user uuid, p_kind text, p_body text) returns void language sql security definer set search_path = public as
$$ insert into notifications (user_id, kind, body) values (p_user, p_kind, p_body) $$;
revoke all on function public.push_notification from public;

create function public.trg_bill_status() returns trigger language plpgsql security definer set search_path = public as
$$ begin
  if new.status is distinct from old.status and new.status <> 'submitted' then
    perform push_notification(new.requester_id, 'bill', 'Your ' || lower(new.category) || ' bill is now: ' ||
      case new.status when 'under_review' then 'under review' when 'more_info' then 'waiting for more information'
        when 'eligible' then 'approved and open for support' when 'partially_supported' then 'partially supported'
        when 'cleared' then 'cleared 🎉' when 'declined' then 'declined' else new.status::text end);
  end if;
  return new;
end $$;
create trigger bill_status_notify after update of status on bills for each row execute function public.trg_bill_status();

create function public.trg_ledger_received() returns trigger language plpgsql security definer set search_path = public as
$$ declare r uuid; cat text;
begin
  if new.kind = 'received' then
    select requester_id, lower(category) into r, cat from bills where id = new.bill_id;
    perform push_notification(r, 'gift', 'Someone gave ₦' || to_char(new.amount_kobo / 100, 'FM999,999,999') || ' to your ' || cat || ' bill.');
  end if;
  return new;
end $$;
create trigger ledger_received_notify after insert on ledger_entries for each row execute function public.trg_ledger_received();

create function public.trg_reply() returns trigger language plpgsql security definer set search_path = public as
$$ declare a uuid; h text;
begin
  if new.parent_id is not null then
    select author_id into a from posts where id = new.parent_id;
    select handle into h from profiles where id = new.author_id;
    if a <> new.author_id then perform push_notification(a, 'reply', '@' || h || ' replied to your post.'); end if;
  end if;
  return new;
end $$;
create trigger reply_notify after insert on posts for each row execute function public.trg_reply();

create function public.trg_like() returns trigger language plpgsql security definer set search_path = public as
$$ declare a uuid; h text;
begin
  select author_id into a from posts where id = new.post_id;
  select handle into h from profiles where id = new.user_id;
  if a <> new.user_id then perform push_notification(a, 'like', '@' || h || ' liked your post.'); end if;
  return new;
end $$;
create trigger like_notify after insert on post_likes for each row execute function public.trg_like();

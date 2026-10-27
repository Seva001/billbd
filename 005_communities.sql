-- Run after 004. One fan community per public figure, plus Student Support. Text posts only.
-- Figure communities are UNOFFICIAL fan spaces until a figure's team is authorized (figures.authorized + claimed_by).
insert into figures (slug, name, tagline, category, authorized) values
 ('te','Tony Elumelu','Business Leader | Investor | Entrepreneur','Business',false),
 ('ad','Aliko Dangote','Industrialist | Business Leader | Investor','Business',false),
 ('ar','Abdul Samad Rabiu','Industrialist | Business Leader','Business',false),
 ('fo','Femi Otedola','Investor | Business Leader','Business',false),
 ('ma','Mike Adenuga','Business Leader | Investor','Business',false),
 ('oc','Obi Cubana','Entrepreneur | Hospitality and Lifestyle','Entertainment',false),
 ('dj','Don Jazzy','Music Executive | Creative Entrepreneur','Entertainment',false),
 ('cp','Cubana Chief Priest','Entertainment & Lifestyle','Entertainment',false),
 ('sp','Shina Peller','Entertainment & Business','Entertainment',false),
 ('kw','Kiddwaya','TV Personality | Lifestyle','Creators',false),
 ('bl','B-Lord','Creator | Lifestyle','Creators',false)
on conflict (slug) do nothing;

create table communities (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('figure','student')),
  figure_id uuid references figures(id),
  slug text unique not null,
  name text not null,
  description text not null,
  check ((kind = 'figure') = (figure_id is not null))
);
create table community_members (
  community_id uuid references communities(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);
create table posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500 and body !~* '(https?://|www\.)'),
  official boolean not null default false,
  created_at timestamptz not null default now()
);
create index on posts (community_id, created_at desc);
create table post_reports (
  post_id uuid references posts(id) on delete cascade,
  reporter_id uuid references profiles(id) on delete cascade,
  reason text not null default 'reported',
  created_at timestamptz not null default now(),
  primary key (post_id, reporter_id)
);

insert into communities (kind, figure_id, slug, name, description)
  select 'figure', id, slug, name || ' fans',
         'A fan space for ' || name || '. Unofficial: ' || name || ' doesn''t run this space unless a post is marked Official.' from figures;
insert into communities (kind, slug, name, description) values
 ('student','student-support','Student Support','Students from any school: encourage each other, share how you’re coping, and find out how to submit a bill.');

-- Official flag is set by the server, never by the client. Also rate-limits posting.
create function public.posts_guard() returns trigger language plpgsql as
$$ begin
  new.official := exists (select 1 from communities c join figures f on f.id = c.figure_id
                          where c.id = new.community_id and f.authorized and f.claimed_by = new.author_id);
  if (select count(*) from posts where author_id = new.author_id and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'rate limit: too many posts';
  end if;
  return new;
end $$;
create trigger posts_guard_t before insert on posts for each row execute function public.posts_guard();

-- Public reads go through views; a post with 3 or more reports drops out of the feed.
create view community_feed as
  select p.id, p.community_id, p.body, p.official, p.created_at, p.author_id, pr.handle as author_handle
  from posts p join profiles pr on pr.id = p.author_id
  where (select count(*) from post_reports r where r.post_id = p.id) < 3;
create view community_stats as
  select community_id, count(*) as members from community_members group by community_id;
grant select on community_feed, community_stats to anon, authenticated;

alter table communities enable row level security;
alter table community_members enable row level security;
alter table posts enable row level security;
alter table post_reports enable row level security;
create policy "communities readable" on communities for select using (true);
create policy "see own memberships" on community_members for select using (user_id = auth.uid());
create policy "join as self" on community_members for insert with check (user_id = auth.uid());
create policy "leave as self" on community_members for delete using (user_id = auth.uid());
create policy "see own posts" on posts for select using (author_id = auth.uid() or is_staff());
create policy "members post" on posts for insert with check (
  author_id = auth.uid() and exists (select 1 from community_members m where m.community_id = posts.community_id and m.user_id = auth.uid()));
create policy "delete own or staff" on posts for delete using (author_id = auth.uid() or is_staff());
create policy "report as self" on post_reports for insert with check (reporter_id = auth.uid());
create policy "staff read reports" on post_reports for select using (is_staff());

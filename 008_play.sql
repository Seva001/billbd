-- Run after 007. Play layer from the v2 design: Arena quiz, daily streak, points + levels, weekly Top 10, saved bills.
-- Points are play-money for fun only: no cash value, can't be bought, sold or withdrawn, and never affect bill review.
create table points_ledger (
  id bigserial primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  points int not null check (points > 0),
  reason text not null,
  ref text not null,
  created_at timestamptz not null default now(),
  unique (user_id, ref)                       -- the same action can't pay twice
);
create table streaks (
  user_id uuid primary key references profiles(id) on delete cascade,
  last_day date not null, streak int not null, best int not null
);
create table quiz_questions (
  id serial primary key, question text not null, options text[] not null, answer int not null, why text not null
);
create table bill_saves (                     -- the swipe deck's watchlist
  user_id uuid references profiles(id) on delete cascade,
  bill_id uuid references bills(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, bill_id)
);
alter table points_ledger enable row level security;
alter table streaks enable row level security;
alter table quiz_questions enable row level security;   -- no policy: correct answers stay hidden from clients
alter table bill_saves enable row level security;
create policy "own points" on points_ledger for select using (user_id = auth.uid());
create policy "own streak" on streaks for select using (user_id = auth.uid());
create policy "own saves" on bill_saves for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Clients never write points, streaks or questions; only the functions below do.

create view quiz_public as select id, question, options from quiz_questions order by id;
create view my_wallet as select
  coalesce((select sum(points) from points_ledger where user_id = auth.uid()), 0)::int as points,
  coalesce((select case when last_day >= (now() at time zone 'Africa/Lagos')::date - 1 then streak else 0 end
            from streaks where user_id = auth.uid()), 0)::int as streak,
  coalesce((select best from streaks where user_id = auth.uid()), 0)::int as best,
  exists (select 1 from streaks where user_id = auth.uid() and last_day = (now() at time zone 'Africa/Lagos')::date) as checked_today;
-- This week (Monday to Sunday, Lagos time). "Give quietly" gifts still count but show as Anonymous supporter.
create view top_clearers as
  select case when l.anonymous then 'Anonymous supporter' else p.display_name end as name,
         (p.id = auth.uid()) as is_me,
         count(distinct l.bill_id)::int as bills_helped, sum(l.amount_kobo)::bigint as given_kobo
  from ledger_entries l join profiles p on p.id = l.supporter_id
  where l.kind = 'received'
    and l.created_at >= (date_trunc('week', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos')
  group by p.id, l.anonymous order by given_kobo desc limit 10;
grant select on quiz_public, my_wallet, top_clearers to authenticated;

create function claim_daily() returns json language plpgsql security definer set search_path = public as $$
declare s streaks; today date := (now() at time zone 'Africa/Lagos')::date; n int; got int := 0;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into s from streaks where user_id = auth.uid();
  if not found then
    insert into streaks values (auth.uid(), today, 1, 1) returning * into s; got := 10;
  elsif s.last_day < today then
    n := case when s.last_day = today - 1 then s.streak + 1 else 1 end;
    update streaks set last_day = today, streak = n, best = greatest(best, n) where user_id = auth.uid() returning * into s;
    got := 10;
  end if;
  if got > 0 then
    insert into points_ledger (user_id, points, reason, ref) values (auth.uid(), got, 'Daily check-in', 'day:' || today) on conflict do nothing;
  end if;
  return json_build_object('awarded', got, 'streak', s.streak);
end $$;

-- Replaying is allowed; the +5 is paid once per question, the first time it is answered right.
create function answer_quiz(p_q int, p_choice int) returns json language plpgsql security definer set search_path = public as $$
declare q quiz_questions; ok boolean; n int := 0;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into q from quiz_questions where id = p_q;
  if not found then raise exception 'No such question'; end if;
  ok := (p_choice = q.answer);
  if ok then
    insert into points_ledger (user_id, points, reason, ref) values (auth.uid(), 5, 'Arena', 'q:' || p_q) on conflict do nothing;
    get diagnostics n = row_count;
  end if;
  return json_build_object('correct', ok, 'answer', q.answer, 'why', q.why, 'awarded', n * 5);
end $$;
grant execute on function claim_daily, answer_quiz to authenticated;

-- Backing a bill earns 2 points once its payment is confirmed. The Paystack webhook is unchanged.
create function award_giving_points() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'received' and new.supporter_id is not null then
    insert into points_ledger (user_id, points, reason, ref) values (new.supporter_id, 2, 'Backed a bill', 'give:' || new.id) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger ledger_points after insert on ledger_entries for each row execute function award_giving_points();

insert into quiz_questions (question, options, answer, why) values
 ('Which company is Aliko Dangote best known for building?', array['Dangote Group','Globacom','BUA Group','Heirs Holdings'], 0, 'Dangote Group is an industrial conglomerate built around cement and sugar, now also refining and fertiliser.'),
 ('Tony Elumelu spent 12 years as Group Chairman of which pan-African bank?', array['Access Bank','UBA','Zenith Bank','GTBank'], 1, 'He chaired UBA (United Bank for Africa) until August 2026 and also founded the investment group Heirs Holdings. His foundation backs African entrepreneurs.'),
 ('Mike Adenuga founded which telecom network?', array['MTN Nigeria','Airtel','Globacom (Glo)','9mobile'], 2, 'Globacom, known as Glo, is his telecom company. His interests also include oil and gas.'),
 ('BUA Group, led by Abdul Samad Rabiu, is well known for which products?', array['Banking and insurance','Cement and sugar','Music and film','Shipping and airlines'], 1, 'BUA Group is a major Nigerian producer of cement and sugar.'),
 ('Femi Otedola built his wealth mainly in which industry?', array['Fashion','Media','Oil and energy','Telecoms'], 2, 'He made his name supplying petroleum products and later moved into power generation.'),
 ('Don Jazzy founded which record label?', array['Chocolate City','YBNL','Starboy Entertainment','Mavin Records'], 3, 'Don Jazzy founded Mavin Records, home to many Afrobeats artists.'),
 ('In which state is the Dangote Refinery located?', array['Lagos','Rivers','Kaduna','Delta'], 0, 'The refinery sits in the Lekki area of Lagos State.'),
 ('What is one hundredth of a Naira called?', array['Cent','Pesewa','Kobo','Piastre'], 2, 'One hundred kobo make one Naira.');

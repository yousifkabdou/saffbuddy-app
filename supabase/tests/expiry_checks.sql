/* Checks for supabase/expiry.sql (delete + tally at start time + 10 minutes).
   Run the block in the SQL Editor; it ends in rollback, so nothing is saved.
   "Success. No rows returned" = every check passed; a failure stops with "FAIL: <checks>".
   Fake users: c1 / c3 / c4 / c6 / c8 = requesters, c2 / c5 / c7 / c9 = joiners. All Men, room 057.
   The day is taken from A's start time, not today, so this also passes just after midnight. */
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'c1@osu.edu'),
  ('00000000-0000-0000-0000-0000000000c2', 'c2@osu.edu'),
  ('00000000-0000-0000-0000-0000000000c3', 'c3@osu.edu'),
  ('00000000-0000-0000-0000-0000000000c4', 'c4@osu.edu'),
  ('00000000-0000-0000-0000-0000000000c5', 'c5@osu.edu'),
  ('00000000-0000-0000-0000-0000000000c6', 'c6@osu.edu'),
  ('00000000-0000-0000-0000-0000000000c7', 'c7@osu.edu'),
  ('00000000-0000-0000-0000-0000000000c8', 'c8@osu.edu'),
  ('00000000-0000-0000-0000-0000000000c9', 'c9@osu.edu');
insert into public.profiles (id, first_name, gender) values
  ('00000000-0000-0000-0000-0000000000c1', 'Test', 'Men'),
  ('00000000-0000-0000-0000-0000000000c2', 'Test', 'Men'),
  ('00000000-0000-0000-0000-0000000000c3', 'Test', 'Men'),
  ('00000000-0000-0000-0000-0000000000c4', 'Test', 'Men'),
  ('00000000-0000-0000-0000-0000000000c5', 'Test', 'Men'),
  ('00000000-0000-0000-0000-0000000000c6', 'Test', 'Men'),
  ('00000000-0000-0000-0000-0000000000c7', 'Test', 'Men'),
  ('00000000-0000-0000-0000-0000000000c8', 'Test', 'Men'),
  ('00000000-0000-0000-0000-0000000000c9', 'Test', 'Men');

-- Tally for room 057 on A's day (11 minutes ago, Eastern), before the run (0 if no row yet).
create temp table base as
  select coalesce(sum(congregations), 0) as c, coalesce(sum(buddies), 0) as b
  from public.congregation_tally
  where room_id = (select id from public.rooms where room_num = '057')
    and day_of = ((now() - interval '11 minutes') at time zone 'America/New_York')::date;

-- Inserted as postgres, so the 5-45 min insert policy doesn't apply; that lets us backdate.
-- A: started 11 min ago, two joiners -> past 10: deleted AND counted (1 congregation, 3 people)
-- D: started 11 min ago, one joiner   -> counted too: with A, +2 congregations and +5 people
-- B: started 9 min ago, no joiner    -> NEGATIVE: not yet 10, must survive
-- C: started 11 min ago, no joiner   -> deleted, NOT counted (nobody joined)
insert into public.requests (id, room_id, requester, gender, start_time) values
  ('30000000-0000-0000-0000-00000000000a', (select id from public.rooms where room_num = '057'),
   '00000000-0000-0000-0000-0000000000c1', 'Men', now() - interval '11 minutes'),
  ('30000000-0000-0000-0000-00000000000b', (select id from public.rooms where room_num = '057'),
   '00000000-0000-0000-0000-0000000000c3', 'Men', now() - interval '9 minutes'),
  ('30000000-0000-0000-0000-00000000000c', (select id from public.rooms where room_num = '057'),
   '00000000-0000-0000-0000-0000000000c4', 'Men', now() - interval '11 minutes'),
  ('30000000-0000-0000-0000-00000000000d', (select id from public.rooms where room_num = '057'),
   '00000000-0000-0000-0000-0000000000c6', 'Men', now() - interval '11 minutes');
insert into public.joiners (member, request_id) values
  ('00000000-0000-0000-0000-0000000000c2', '30000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000c5', '30000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000c7', '30000000-0000-0000-0000-00000000000d');

select public.expire_requests();

create temp table results (test text, expected bigint, actual bigint);
insert into results select '1 A (11 min) deleted', 0,
  (select count(*) from public.requests where id = '30000000-0000-0000-0000-00000000000a');
insert into results select '2 A''s joiner removed by cascade', 0,
  (select count(*) from public.joiners where member = '00000000-0000-0000-0000-0000000000c2');
insert into results select '3 NEGATIVE: B (9 min) still there', 1,
  (select count(*) from public.requests where id = '30000000-0000-0000-0000-00000000000b');
insert into results select '4 C (11 min, no joiner) deleted', 0,
  (select count(*) from public.requests where id = '30000000-0000-0000-0000-00000000000c');
insert into results select '5 tally: +2 congregations (A and D, one each; not C)', 2,
  (select coalesce(sum(congregations), 0) from public.congregation_tally
   where room_id = (select id from public.rooms where room_num = '057')
     and day_of = ((now() - interval '11 minutes') at time zone 'America/New_York')::date) - (select c from base);
insert into results select '6 tally: +5 people (A: 1 + 2 joiners, D: 1 + 1)', 5,
  (select coalesce(sum(buddies), 0) from public.congregation_tally
   where room_id = (select id from public.rooms where room_num = '057')
     and day_of = ((now() - interval '11 minutes') at time zone 'America/New_York')::date) - (select b from base);

-- E: another expired request with one joiner, expired by a second run. The day's row already
-- exists, so this exercises "on conflict ... do update" (adding to the row, not replacing it).
insert into public.requests (id, room_id, requester, gender, start_time) values
  ('30000000-0000-0000-0000-00000000000e', (select id from public.rooms where room_num = '057'),
   '00000000-0000-0000-0000-0000000000c8', 'Men', now() - interval '11 minutes');
insert into public.joiners (member, request_id) values
  ('00000000-0000-0000-0000-0000000000c9', '30000000-0000-0000-0000-00000000000e');
select public.expire_requests();
insert into results select '7 second run adds to the same row: +3 congregations in all', 3,
  (select coalesce(sum(congregations), 0) from public.congregation_tally
   where room_id = (select id from public.rooms where room_num = '057')
     and day_of = ((now() - interval '11 minutes') at time zone 'America/New_York')::date) - (select c from base);
insert into results select '8 second run: +7 people in all', 7,
  (select coalesce(sum(buddies), 0) from public.congregation_tally
   where room_id = (select id from public.rooms where room_num = '057')
     and day_of = ((now() - interval '11 minutes') at time zone 'America/New_York')::date) - (select b from base);

select test, expected, actual, case when expected = actual then 'pass' else 'FAIL' end as result
from results;

-- Stop with an error naming any failed check, so a failure can't be missed (and npm test fails).
do $$
declare failed text;
begin
  select string_agg(test, '; ') into failed from results where expected::text is distinct from actual::text;
  if failed is not null then raise exception 'FAIL: %', failed; end if;
end $$;

rollback;

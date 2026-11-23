/* Checks for supabase/expiry.sql (delete + tally at start time + 10 minutes).
   Run the block in the SQL Editor; it ends in rollback, so nothing is saved.
   Fake users: ...c1 / ...c3 = requesters, ...c2 = joiner. All Men, room 057. */
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'c1@osu.edu'),
  ('00000000-0000-0000-0000-0000000000c2', 'c2@osu.edu'),
  ('00000000-0000-0000-0000-0000000000c3', 'c3@osu.edu'),
  ('00000000-0000-0000-0000-0000000000c4', 'c4@osu.edu');
insert into public.profiles (id, first_name, gender) values
  ('00000000-0000-0000-0000-0000000000c1', 'Test', 'Men'),
  ('00000000-0000-0000-0000-0000000000c2', 'Test', 'Men'),
  ('00000000-0000-0000-0000-0000000000c3', 'Test', 'Men'),
  ('00000000-0000-0000-0000-0000000000c4', 'Test', 'Men');

-- Tally for room 057 today, before the run (0 if no row yet).
create temp table base as
  select coalesce(sum(congregations), 0) as c, coalesce(sum(buddies), 0) as b
  from public.congregation_tally
  where room_id = (select id from public.rooms where room_num = '057')
    and day_of = (now() at time zone 'America/New_York')::date;

-- Inserted as postgres, so the 5-45 min insert policy doesn't apply; that lets us backdate.
-- A: started 11 min ago, one joiner  -> past 10: deleted AND counted (1 congregation, 2 people)
-- B: started 9 min ago, no joiner    -> NEGATIVE: not yet 10, must survive
-- C: started 11 min ago, no joiner   -> deleted, NOT counted (nobody joined)
insert into public.requests (id, room_id, requester, gender, start_time) values
  ('30000000-0000-0000-0000-00000000000a', (select id from public.rooms where room_num = '057'),
   '00000000-0000-0000-0000-0000000000c1', 'Men', now() - interval '11 minutes'),
  ('30000000-0000-0000-0000-00000000000b', (select id from public.rooms where room_num = '057'),
   '00000000-0000-0000-0000-0000000000c3', 'Men', now() - interval '9 minutes'),
  ('30000000-0000-0000-0000-00000000000c', (select id from public.rooms where room_num = '057'),
   '00000000-0000-0000-0000-0000000000c4', 'Men', now() - interval '11 minutes');
insert into public.joiners (member, request_id) values
  ('00000000-0000-0000-0000-0000000000c2', '30000000-0000-0000-0000-00000000000a');

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
insert into results select '5 tally: +1 congregation (A only, not C)', 1,
  (select coalesce(sum(congregations), 0) from public.congregation_tally
   where room_id = (select id from public.rooms where room_num = '057')
     and day_of = (now() at time zone 'America/New_York')::date) - (select c from base);
insert into results select '6 tally: +2 people (A''s requester + joiner)', 2,
  (select coalesce(sum(buddies), 0) from public.congregation_tally
   where room_id = (select id from public.rooms where room_num = '057')
     and day_of = (now() at time zone 'America/New_York')::date) - (select b from base);

select test, expected, actual, case when expected = actual then 'pass' else 'FAIL' end as result
from results;

rollback;

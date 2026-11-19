/* Checks for supabase/live_updates.sql. Run each block on its own in the
   SQL Editor (each ends in rollback, so nothing is saved).
   Fake users: ...a1 = Women requester, ...a2 = Women joiner, ...b1 = Men. */


/* ---------- Block A: who gets pinged (the triggers) ----------
   Expected: every row says pass. Counts are deltas from before the test.
   If a real request expires during the run, a Women/Men count can be 1 high;
   just rerun. */
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a1@osu.edu'),
  ('00000000-0000-0000-0000-0000000000a2', 'a2@osu.edu'),
  ('00000000-0000-0000-0000-0000000000b1', 'b1@osu.edu');
insert into public.profiles (id, first_name, gender) values
  ('00000000-0000-0000-0000-0000000000a1', 'Test', 'Women'),
  ('00000000-0000-0000-0000-0000000000a2', 'Test', 'Women'),
  ('00000000-0000-0000-0000-0000000000b1', 'Test', 'Men');

create function pg_temp.pings(t text) returns bigint language sql as
  $$ select count(*) from realtime.messages where topic = t and event = 'changed' $$;
create temp table base as
  select pg_temp.pings('requests:Women') as w, pg_temp.pings('requests:Men') as m;
create temp table results (test text, expected bigint, actual bigint);

-- 1. Posting a Women request pings Women once, Men never
insert into public.requests (id, room_id, requester, gender, start_time) values
  ('20000000-0000-0000-0000-000000000001', (select id from public.rooms where room_num = '057'),
   '00000000-0000-0000-0000-0000000000a1', 'Women', now() + interval '10 minutes');
insert into results select '1 post: Women pinged', 1, pg_temp.pings('requests:Women') - w from base;

-- 2. Joining pings the request's gender
insert into public.joiners (member, request_id) values
  ('00000000-0000-0000-0000-0000000000a2', '20000000-0000-0000-0000-000000000001');
insert into results select '2 join: Women pinged again', 2, pg_temp.pings('requests:Women') - w from base;

-- 3. Leaving pings too
delete from public.joiners where member = '00000000-0000-0000-0000-0000000000a2';
insert into results select '3 leave: Women pinged again', 3, pg_temp.pings('requests:Women') - w from base;

-- 4. Cancelling a request WITH a joiner: exactly one ping (joiner trigger skips)
insert into public.joiners (member, request_id) values
  ('00000000-0000-0000-0000-0000000000a2', '20000000-0000-0000-0000-000000000001'); -- +1 (= 4)
delete from public.requests where id = '20000000-0000-0000-0000-000000000001';      -- +1 only (= 5)
insert into results select '4 cancel with joiner: one ping, not two', 5, pg_temp.pings('requests:Women') - w from base;

-- 5. NEGATIVE: none of the Women activity reached the Men channel
insert into results select '5 Men never pinged by Women activity', 0, pg_temp.pings('requests:Men') - m from base;

-- 6. A Men request pings Men
insert into public.requests (room_id, requester, gender, start_time) values
  ((select id from public.rooms where room_num = '057'),
   '00000000-0000-0000-0000-0000000000b1', 'Men', now() + interval '10 minutes');
insert into results select '6 Men post: Men pinged', 1, pg_temp.pings('requests:Men') - m from base;

select test, expected, actual, case when expected = actual then 'pass' else 'FAIL' end as result
from results;

rollback;


/* ---------- Block B: who may listen (the policy) ----------
   Simulates what Realtime does when a user joins a private channel: it sets
   realtime.topic to the channel name and checks the policy as that user.
   Expected: every row says pass. */
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a1@osu.edu'),
  ('00000000-0000-0000-0000-0000000000b1', 'b1@osu.edu');
insert into public.profiles (id, first_name, gender) values
  ('00000000-0000-0000-0000-0000000000a1', 'Test', 'Women'),
  ('00000000-0000-0000-0000-0000000000b1', 'Test', 'Men');

-- One broadcast and one presence message to test against ('test-ping' so real pings don't count)
insert into realtime.messages (topic, extension, event, payload, private) values
  ('requests:Women', 'broadcast', 'test-ping', '{}', true),
  ('requests:Women', 'presence',  'test-ping', '{}', true);

create temp table results (test text, expected bigint, actual bigint);
grant select, insert on results to authenticated;

set local role authenticated;

-- 1. Women user on the Women channel: sees the broadcast, not the presence message
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select set_config('realtime.topic', 'requests:Women', true);
insert into results select '1 Women user, Women channel: broadcast only', 1, count(*) from realtime.messages where event = 'test-ping';

-- 2. NEGATIVE: Women user asking for the Men channel gets nothing
select set_config('realtime.topic', 'requests:Men', true);
insert into results select '2 Women user, Men channel: nothing', 0, count(*) from realtime.messages where event = 'test-ping';

-- 3. NEGATIVE: Men user asking for the Women channel gets nothing
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select set_config('realtime.topic', 'requests:Women', true);
insert into results select '3 Men user, Women channel: nothing', 0, count(*) from realtime.messages where event = 'test-ping';

-- 4. Men user on the Men channel is allowed (broadcast only, still not presence)
select set_config('realtime.topic', 'requests:Men', true);
insert into results select '4 Men user, Men channel: broadcast only', 1, count(*) from realtime.messages where event = 'test-ping';

-- 5. NEGATIVE: a channel name that isn't requests:<gender>
select set_config('realtime.topic', 'something-else', true);
insert into results select '5 Men user, other channel: nothing', 0, count(*) from realtime.messages where event = 'test-ping';

select test, expected, actual, case when expected = actual then 'pass' else 'FAIL' end as result
from results;

rollback;


/* ---------- Block C: NEGATIVE, logged-out users can't listen ----------
   Expected: 0, or "permission denied for table messages". Either is a pass. */
begin;
insert into realtime.messages (topic, extension, event, payload, private)
values ('requests:Women', 'broadcast', 'test-ping', '{}', true);
set local role anon;
select set_config('realtime.topic', 'requests:Women', true);
select count(*) as anon_sees from realtime.messages where event = 'test-ping';
rollback;


/* ---------- Block D: NEGATIVE, users can't send pings themselves ----------
   Expected: ERROR "new row violates row-level security policy" (or
   "permission denied"). Either is a pass. */
begin;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'a1@osu.edu');
insert into public.profiles (id, first_name, gender) values ('00000000-0000-0000-0000-0000000000a1', 'Test', 'Women');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select set_config('realtime.topic', 'requests:Women', true);
insert into realtime.messages (topic, extension, event, payload, private)
values ('requests:Women', 'broadcast', 'changed', '{}', true);
rollback;

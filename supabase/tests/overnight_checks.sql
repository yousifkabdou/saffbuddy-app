/* Overnight edge-case checks (2026-11-25), on top of security_checks.sql.
   Covers gaps: users with no profile, shared rooms, error-code leaks, kicking or removing other
   people's joins, post_request inputs, OSU email edge cases, and the Eastern-time tally day.
   Ends in rollback, so nothing is saved. A failure stops with "FAIL: <check names>".

   Fake users: m1-m3 = Men, w1 = Women, n1 = signed in with no profile, x1-x8 = Men (tally block).
   Rooms: 050 = Men only, 060 = Women only, 057 = shared, 507 = shared (tally block only). */
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'm1@osu.edu'),
  ('00000000-0000-0000-0000-0000000000e2', 'm2@osu.edu'),
  ('00000000-0000-0000-0000-0000000000e3', 'm3@osu.edu'),
  ('00000000-0000-0000-0000-0000000000f1', 'w1@osu.edu'),
  ('00000000-0000-0000-0000-0000000000a9', 'n1@osu.edu');
insert into auth.users (id, email)
  select ('00000000-0000-0000-0000-0000000001' || lpad(n::text, 2, '0'))::uuid, 'x' || n || '@osu.edu'
  from generate_series(1, 8) n;
insert into public.profiles (id, first_name, gender) values
  ('00000000-0000-0000-0000-0000000000e1', 'Test', 'Men'),
  ('00000000-0000-0000-0000-0000000000e2', 'Test', 'Men'),
  ('00000000-0000-0000-0000-0000000000e3', 'Test', 'Men'),
  ('00000000-0000-0000-0000-0000000000f1', 'Test', 'Women');
insert into public.profiles (id, first_name, gender)
  select ('00000000-0000-0000-0000-0000000001' || lpad(n::text, 2, '0'))::uuid, 'Test', 'Men'
  from generate_series(1, 8) n;

-- Same helpers as security_checks.sql (pg_temp functions only live for this file's session).
create function pg_temp.attempt(who uuid, stmt text) returns text language plpgsql as $$
declare n bigint;
begin
  perform set_config('request.jwt.claims',
    case when who is null then '{"role":"anon"}'
         else json_build_object('sub', who, 'role', 'authenticated')::text end, true);
  if who is null then set local role anon; else set local role authenticated; end if;
  execute stmt;
  get diagnostics n = row_count;
  reset role;
  return 'ok:' || n;
exception when others then
  reset role;
  return 'error:' || sqlstate;
end $$;

-- Like attempt, but returns the single value the query selects (for functions returning a value).
create function pg_temp.value_as(who uuid, stmt text) returns text language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true);
  set local role authenticated;
  execute stmt into v;
  reset role;
  return coalesce(v, 'null');
exception when others then
  reset role;
  return 'error:' || sqlstate;
end $$;

create function pg_temp.admin(stmt text) returns text language plpgsql as $$
declare n bigint;
begin
  execute stmt;
  get diagnostics n = row_count;
  return 'ok:' || n;
exception when others then
  return 'error:' || sqlstate;
end $$;

create temp table results (test text, expected text, actual text);
create function pg_temp.check(test text, expected text, actual text) returns void language sql as $$
  insert into results values (test, expected, actual)
$$;

create function pg_temp.u(name text) returns uuid language sql immutable as $$
  select case name
    when 'm1' then '00000000-0000-0000-0000-0000000000e1' when 'm2' then '00000000-0000-0000-0000-0000000000e2'
    when 'm3' then '00000000-0000-0000-0000-0000000000e3' when 'w1' then '00000000-0000-0000-0000-0000000000f1'
    when 'n1' then '00000000-0000-0000-0000-0000000000a9'
    else '00000000-0000-0000-0000-0000000001' || lpad(substr(name, 2), 2, '0') end::uuid
$$;
create function pg_temp.room(num text) returns uuid language sql stable as $$
  select id from public.rooms where room_num = num
$$;
create function pg_temp.request_of(who uuid) returns uuid language sql stable as $$
  select id from public.requests where requester = who
$$;


/* ---------- Shared rooms keep genders apart ---------- */
-- m1 posts a Men request in the shared room 057.
select pg_temp.check('O1 Men user posts in a shared room', 'ok:1',
  pg_temp.attempt(pg_temp.u('m1'), format('select public.post_request(%L, 10)', pg_temp.room('057'))));
select pg_temp.check('O2 NEGATIVE: Women user cannot see a Men request in a shared room', 'ok:0',
  pg_temp.attempt(pg_temp.u('w1'), format('select id from public.requests where room_id = %L', pg_temp.room('057'))));
select pg_temp.check('O3 NEGATIVE: Women user cannot join a Men request in a shared room', 'error',
  pg_temp.attempt(pg_temp.u('w1'), format('insert into public.joiners values (%L, %L)', pg_temp.u('w1'), pg_temp.request_of(pg_temp.u('m1')))));
select pg_temp.check('O4 NEGATIVE: Women user cannot post as Women in a Men-only room (direct insert)', 'error',
  pg_temp.attempt(pg_temp.u('w1'), format('insert into public.requests (room_id, requester, gender, start_time) values (%L, %L, ''Women'', now() + interval ''10 minutes'')', pg_temp.room('050'), pg_temp.u('w1'))));
select pg_temp.check('O5 NEGATIVE: Women user''s request_count shows no Men request', 'ok:0',
  pg_temp.attempt(pg_temp.u('w1'), 'select * from public.request_count()'));


/* ---------- No error-code leaks ----------
   If joining a hidden (other-gender) request failed with a different error than joining a
   request id that doesn't exist, a user could probe ids to learn the other gender's activity. */
select pg_temp.check('O6 NEGATIVE: joining a hidden request and a made-up id fail the same way', 'true',
  (pg_temp.attempt(pg_temp.u('w1'), format('insert into public.joiners values (%L, %L)', pg_temp.u('w1'), pg_temp.request_of(pg_temp.u('m1')))) =
   pg_temp.attempt(pg_temp.u('w1'), format('insert into public.joiners values (%L, %L)', pg_temp.u('w1'), gen_random_uuid())))::text);
select pg_temp.check('O7 NEGATIVE: posting in a hidden room and a made-up room fail the same way', 'true',
  (pg_temp.attempt(pg_temp.u('w1'), format('select public.post_request(%L, 10)', pg_temp.room('050'))) =
   pg_temp.attempt(pg_temp.u('w1'), format('select public.post_request(%L, 10)', gen_random_uuid())))::text);


/* ---------- Signed in but no profile (between login and setup) ---------- */
select pg_temp.check('O8 NEGATIVE: no-profile user cannot post', 'error',
  pg_temp.attempt(pg_temp.u('n1'), format('select public.post_request(%L, 10)', pg_temp.room('057'))));
select pg_temp.check('O9 NEGATIVE: no-profile user cannot join', 'error',
  pg_temp.attempt(pg_temp.u('n1'), format('insert into public.joiners values (%L, %L)', pg_temp.u('n1'), pg_temp.request_of(pg_temp.u('m1')))));
select pg_temp.check('O10 NEGATIVE: no-profile user sees no requests', 'ok:0',
  pg_temp.attempt(pg_temp.u('n1'), 'select id from public.requests'));
select pg_temp.check('O11 NEGATIVE: no-profile user gets no counts', 'ok:0',
  pg_temp.attempt(pg_temp.u('n1'), 'select * from public.request_count()'));
select pg_temp.check('O12 NEGATIVE: no-profile user cannot pick a gender outside Men/Women', 'error',
  pg_temp.attempt(pg_temp.u('n1'), format('insert into public.profiles values (%L, ''Ali'', ''Other'')', pg_temp.u('n1'))));
select pg_temp.check('O13 NEGATIVE: user cannot create a second profile for themselves', 'error',
  pg_temp.attempt(pg_temp.u('m1'), format('insert into public.profiles values (%L, ''Ali'', ''Women'')', pg_temp.u('m1'))));


/* ---------- my_request_id / check_for_member_request only ever describe the caller ---------- */
select pg_temp.check('O14 my_request_id returns the caller''s own request', 'true',
  (pg_temp.value_as(pg_temp.u('m1'), 'select public.my_request_id()') = pg_temp.request_of(pg_temp.u('m1'))::text)::text);
select pg_temp.check('O15 NEGATIVE: my_request_id is null for someone without a request', 'null',
  pg_temp.value_as(pg_temp.u('w1'), 'select public.my_request_id()'));


/* ---------- Joins: no kicking, no removing others, one join at a time ---------- */
select pg_temp.check('O16 m2 joins m1''s request', 'ok:1',
  pg_temp.attempt(pg_temp.u('m2'), format('insert into public.joiners values (%L, %L)', pg_temp.u('m2'), pg_temp.request_of(pg_temp.u('m1')))));
select pg_temp.check('O17 check_for_member_request returns the joined request', 'true',
  (pg_temp.value_as(pg_temp.u('m2'), 'select public.check_for_member_request()') = pg_temp.request_of(pg_temp.u('m1'))::text)::text);
select pg_temp.check('O18 NEGATIVE: requester cannot remove (kick) their joiners', 'ok:0',
  pg_temp.attempt(pg_temp.u('m1'), format('delete from public.joiners where request_id = %L', pg_temp.request_of(pg_temp.u('m1')))));
select pg_temp.check('O19 NEGATIVE: another user cannot remove someone else''s join', 'ok:0',
  pg_temp.attempt(pg_temp.u('m3'), format('delete from public.joiners where member = %L', pg_temp.u('m2'))));
select pg_temp.admin(format('insert into public.requests (room_id, requester, gender, start_time) values (%L, %L, ''Men'', now() + interval ''20 minutes'')', pg_temp.room('050'), pg_temp.u('m3')));
select pg_temp.check('O20 NEGATIVE: cannot join a second request while joined', 'error',
  pg_temp.attempt(pg_temp.u('m2'), format('insert into public.joiners values (%L, %L)', pg_temp.u('m2'), pg_temp.request_of(pg_temp.u('m3')))));
select pg_temp.check('O21 NEGATIVE: joiner cannot delete the request they joined', 'ok:0',
  pg_temp.attempt(pg_temp.u('m2'), format('delete from public.requests where id = %L', pg_temp.request_of(pg_temp.u('m1')))));

-- The app picks its message from the error code (actionErrorMessage in src/lib/errors.ts):
-- 23514 = "You're already in another request" / "You already have a request", 23505 = duplicate.
select pg_temp.check('O35 posting while joined fails with 23514 (the "already in a request" message)', 'error:23514',
  pg_temp.attempt(pg_temp.u('m2'), format('select public.post_request(%L, 10)', pg_temp.room('050'))));
select pg_temp.check('O36 joining while holding a request fails with 23514 (the "already have a request" message)', 'error:23514',
  pg_temp.attempt(pg_temp.u('m3'), format('insert into public.joiners values (%L, %L)', pg_temp.u('m3'), pg_temp.request_of(pg_temp.u('m1')))));
select pg_temp.check('O37 joining a second request while joined fails with 23505 (the "already in a request" message)', 'error:23505',
  pg_temp.attempt(pg_temp.u('m2'), format('insert into public.joiners values (%L, %L)', pg_temp.u('m2'), pg_temp.request_of(pg_temp.u('m3')))));
select pg_temp.check('O38 posting a second request fails with 23505 (the "already have a request" message)', 'error:23505',
  pg_temp.attempt(pg_temp.u('m1'), format('select public.post_request(%L, 10)', pg_temp.room('050'))));
-- A request that just got cancelled or expired: "may have already started or been cancelled" covers 23503 and 42501.
select pg_temp.check('O39 joining a request that no longer exists fails with 42501 or 23503', 'true',
  (pg_temp.attempt(pg_temp.u('m1'), format('insert into public.joiners values (%L, %L)', pg_temp.u('w1'), gen_random_uuid())) in ('error:42501', 'error:23503')
   or pg_temp.attempt(pg_temp.u('x8'), format('insert into public.joiners values (%L, %L)', pg_temp.u('x8'), gen_random_uuid())) in ('error:42501', 'error:23503'))::text);


/* ---------- post_request inputs ---------- */
select pg_temp.check('O22 NEGATIVE: post_request refuses ' || coalesce(m::text, 'null') || ' minutes', 'error',
  pg_temp.attempt(pg_temp.u('w1'), format('select public.post_request(%L, %s)', pg_temp.room('060'), coalesce(m::text, 'null'))))
from (values (0), (-5), (4), (46), (null::int)) v(m);
select pg_temp.check('O23 NEGATIVE: post_request refuses a null room', 'error',
  pg_temp.attempt(pg_temp.u('w1'), 'select public.post_request(null, 10)'));
-- The policy allows 4-46 minutes for direct inserts (1 min slack each side).
select pg_temp.check('O24 direct insert at 45 minutes is allowed', 'ok:1',
  pg_temp.attempt(pg_temp.u('w1'), format('insert into public.requests (room_id, requester, gender, start_time) values (%L, %L, ''Women'', now() + interval ''45 minutes'')', pg_temp.room('060'), pg_temp.u('w1'))));
select pg_temp.admin(format('delete from public.requests where requester = %L', pg_temp.u('w1')));
select pg_temp.check('O25 NEGATIVE: direct insert at 46 min 1 s is refused', 'error',
  pg_temp.attempt(pg_temp.u('w1'), format('insert into public.requests (room_id, requester, gender, start_time) values (%L, %L, ''Women'', now() + interval ''46 minutes 1 second'')', pg_temp.room('060'), pg_temp.u('w1'))));


/* ---------- Join cutoff boundary (start + 2 minutes) ---------- */
-- x1's request started 1 min 50 s ago: still joinable and leavable.
select pg_temp.admin(format('insert into public.requests (room_id, requester, gender, start_time) values (%L, %L, ''Men'', now() - interval ''110 seconds'')', pg_temp.room('050'), pg_temp.u('x1')));
select pg_temp.check('O26 join just before the cutoff works', 'ok:1',
  pg_temp.attempt(pg_temp.u('x2'), format('insert into public.joiners values (%L, %L)', pg_temp.u('x2'), pg_temp.request_of(pg_temp.u('x1')))));
select pg_temp.check('O27 leave just before the cutoff works', 'ok:1',
  pg_temp.attempt(pg_temp.u('x2'), format('delete from public.joiners where member = %L', pg_temp.u('x2'))));
select pg_temp.check('O28 cancel just before the cutoff works', 'ok:1',
  -- By id, like the app (useRequests.ts): users can't filter on requester, they have no select on it.
  pg_temp.attempt(pg_temp.u('x1'), format('delete from public.requests where id = %L', pg_temp.request_of(pg_temp.u('x1')))));


/* ---------- Realtime: a user with no profile hears nothing ---------- */
insert into realtime.messages (topic, extension, event, payload, private)
values ('requests:Men', 'broadcast', 'test-ping', '{}', true), ('requests:Women', 'broadcast', 'test-ping', '{}', true);
select set_config('realtime.topic', 'requests:Men', true);
select pg_temp.check('O29 NEGATIVE: no-profile user cannot read the Men channel', 'ok:0',
  pg_temp.attempt(pg_temp.u('n1'), 'select * from realtime.messages where event = ''test-ping'''));
select set_config('realtime.topic', 'requests:', true);
select pg_temp.check('O30 NEGATIVE: an empty gender channel name matches nothing', 'ok:0',
  pg_temp.attempt(pg_temp.u('n1'), 'select * from realtime.messages where event = ''test-ping'''));
select set_config('realtime.topic', '', true);


/* ---------- OSU email edge cases ---------- */
select pg_temp.check('O31 is_osu_email(' || email || ')', expected::text, public.is_osu_email(email)::text)
from (values ('x@osu.edu ', false),          -- trailing space is not an OSU address
             ('x@evil.com@osu.edu', false),  -- two @ signs: not a real address
             ('x%@osu.edu', true),           -- LIKE wildcards in the address itself don't matter
             ('x@0su.edu', false),
             ('x@osu_edu', false),           -- "_" in the pattern? no, the pattern is fixed; "_" here is literal
             ('x@OSU.edu', true)) v(email, expected);
select pg_temp.check('O32 NEGATIVE: hook refuses an email that is not a string', 'true',
  (public.verify_osu_email('{"user":{"email":null}}') ? 'error')::text);


/* ---------- Tally day is the Eastern date, across midnight and DST ----------
   Requests are backdated as admin with fixed timestamps, then expired. Room 507 starts empty.
   Each has one joiner, so each counts as 1 congregation and 2 people. */
select pg_temp.admin(format('insert into public.requests (room_id, requester, gender, start_time) values (%L, %L, ''Men'', %L)',
  pg_temp.room('507'), pg_temp.u(r), t))
from (values ('x3', '2026-11-25 03:00:00+00'),   -- 22:00 EST Nov 24
             ('x5', '2026-11-01 05:30:00+00'),   -- 01:30 EDT Nov 1 (before clocks go back)
             ('x7', '2026-03-08 04:30:00+00')) v(r, t); -- 23:30 EST Mar 7 (night before clocks go forward)
select pg_temp.admin(format('insert into public.joiners values (%L, %L)', pg_temp.u(j), pg_temp.request_of(pg_temp.u(r))))
from (values ('x4', 'x3'), ('x6', 'x5'), ('x8', 'x7')) v(j, r);
select public.expire_requests();
select pg_temp.check('O33 tally day ' || d || ' (Eastern) has 1 congregation, 2 people', '1/2',
  coalesce((select congregations || '/' || buddies from public.congregation_tally
            where room_id = pg_temp.room('507') and day_of = d::date), 'none'))
from (values ('2026-11-24'), ('2026-11-01'), ('2026-03-07')) v(d);
select pg_temp.check('O34 NEGATIVE: no tally row on the UTC dates instead', '0',
  (select count(*) from public.congregation_tally
   where room_id = pg_temp.room('507') and day_of in ('2026-11-25', '2026-03-08'))::text);


select test, expected, actual,
  case when actual = expected or (expected = 'error' and actual like 'error:%') then 'pass' else 'FAIL' end as result
from results;

do $$
declare failed text;
begin
  select string_agg(test || ' (expected ' || expected || ', got ' || coalesce(actual, 'null') || ')', '; ')
  into failed from results
  where not (actual = expected or (expected = 'error' and actual like 'error:%'));
  if failed is not null then raise exception 'FAIL: %', failed; end if;
end $$;

rollback;

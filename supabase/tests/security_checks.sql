/* Checks for who can see and write what: grants, profiles, requests, joiners, rooms, the tally,
   the OSU email rules and the 2026-11-23 hardening. Every rule has its negative case.

   Run the whole file in the SQL Editor. It ends in rollback, so nothing is saved.
   Result: "Success. No rows returned" = every check passed. A failure stops with an error
   "FAIL: <check names>". To see every row, run everything above the last "do" block plus
   the select before it.
   npm test also runs this file on a local Postgres (src/lib/__tests__/sql.test.ts).

   Fake users: m1-m5 = Men, w1 = Women, n1 = signed in with no profile, null = logged out.
   Rooms: 050 = Men only, 060 = Women only, 057 = shared. */
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'm1@osu.edu'),
  ('00000000-0000-0000-0000-0000000000e2', 'm2@osu.edu'),
  ('00000000-0000-0000-0000-0000000000e3', 'm3@osu.edu'),
  ('00000000-0000-0000-0000-0000000000e4', 'm4@osu.edu'),
  ('00000000-0000-0000-0000-0000000000e5', 'm5@osu.edu'),
  ('00000000-0000-0000-0000-0000000000f1', 'w1@osu.edu'),
  ('00000000-0000-0000-0000-0000000000a9', 'n1@osu.edu');
insert into public.profiles (id, first_name, gender) values
  ('00000000-0000-0000-0000-0000000000e1', 'Test', 'Men'),
  ('00000000-0000-0000-0000-0000000000e2', 'Test', 'Men'),
  ('00000000-0000-0000-0000-0000000000e3', 'Test', 'Men'),
  ('00000000-0000-0000-0000-0000000000e4', 'Test', 'Men'),
  ('00000000-0000-0000-0000-0000000000e5', 'Test', 'Men'),
  ('00000000-0000-0000-0000-0000000000f1', 'Test', 'Women');

/* Runs one statement as a user, the way PostgREST would: role authenticated (or anon when
   who is null) and auth.uid() = who. Returns 'ok:<rows>' or 'error:<sqlstate>'.
   The exception block undoes the statement's effects if it fails. */
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

-- Same, as the admin (postgres): used for setup steps and the name and email checks.
create function pg_temp.admin(stmt text) returns text language plpgsql as $$
declare n bigint;
begin
  execute stmt;
  get diagnostics n = row_count;
  return 'ok:' || n;
exception when others then
  return 'error:' || sqlstate;
end $$;

-- expected: 'ok:<n>' must match exactly; 'error' matches any error.
create temp table results (test text, expected text, actual text);
create function pg_temp.check(test text, expected text, actual text) returns void language sql as $$
  insert into results values (test, expected, actual)
$$;

-- Shorthands for the user ids, so the statements below stay readable.
create function pg_temp.u(name text) returns uuid language sql immutable as $$
  select case name
    when 'm1' then '00000000-0000-0000-0000-0000000000e1' when 'm2' then '00000000-0000-0000-0000-0000000000e2'
    when 'm3' then '00000000-0000-0000-0000-0000000000e3' when 'm4' then '00000000-0000-0000-0000-0000000000e4'
    when 'm5' then '00000000-0000-0000-0000-0000000000e5' when 'w1' then '00000000-0000-0000-0000-0000000000f1'
    when 'n1' then '00000000-0000-0000-0000-0000000000a9' end::uuid
$$;
create function pg_temp.room(num text) returns uuid language sql stable as $$
  select id from public.rooms where room_num = num
$$;
create function pg_temp.request_of(who uuid) returns uuid language sql stable as $$
  select id from public.requests where requester = who
$$;


/* ---------- Grants (read from the catalog) ---------- */
select pg_temp.check('G1 NEGATIVE: authenticated has no table-wide select on requests', 'false',
  has_table_privilege('authenticated', 'public.requests', 'SELECT')::text);
select pg_temp.check('G2 NEGATIVE: authenticated cannot select requests.requester', 'false',
  has_column_privilege('authenticated', 'public.requests', 'requester', 'SELECT')::text);
select pg_temp.check('G3 NEGATIVE: authenticated cannot update or delete profiles', 'false',
  (has_table_privilege('authenticated', 'public.profiles', 'UPDATE')
   or has_table_privilege('authenticated', 'public.profiles', 'DELETE'))::text);
select pg_temp.check('G4 NEGATIVE: authenticated cannot update requests or joiners', 'false',
  (has_table_privilege('authenticated', 'public.requests', 'UPDATE')
   or has_table_privilege('authenticated', 'public.joiners', 'UPDATE'))::text);
select pg_temp.check('G5 NEGATIVE: anon has no privilege on any app table', 'false',
  (select bool_or(has_table_privilege('anon', t, p))
   from unnest(array['public.profiles','public.requests','public.joiners','public.rooms','public.congregation_tally']) t,
        unnest(array['SELECT','INSERT','UPDATE','DELETE']) p)::text);
select pg_temp.check('G6 NEGATIVE: authenticated has no privilege on congregation_tally', 'false',
  (select bool_or(has_table_privilege('authenticated', 'public.congregation_tally', p))
   from unnest(array['SELECT','INSERT','UPDATE','DELETE']) p)::text);
select pg_temp.check('G7 NEGATIVE: authenticated cannot write rooms', 'false',
  (select bool_or(has_table_privilege('authenticated', 'public.rooms', p))
   from unnest(array['INSERT','UPDATE','DELETE']) p)::text);
select pg_temp.check('G8 NEGATIVE: anon cannot run any app function', 'false',
  (select bool_or(has_function_privilege('anon', p.oid, 'EXECUTE'))
   from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('my_request_id', 'request_count', 'check_for_member_request', 'post_request',
       'delete_my_account', 'expire_requests', 'is_osu_email', 'verify_osu_email'))::text);
select pg_temp.check('G9 NEGATIVE: authenticated cannot run the expiry job or the auth hook', 'false',
  (has_function_privilege('authenticated', 'public.expire_requests()', 'EXECUTE')
   or has_function_privilege('authenticated', 'public.verify_osu_email(jsonb)', 'EXECUTE'))::text);
-- Pinned to '' (ours) or to pg_catalog only (Supabase's own rls_auto_enable does this). Both are
-- safe: nobody but the database owner can create objects in pg_catalog, so a caller can't plant a
-- lookalike table or function there. Unpinned, or pinned to a schema users can write to, fails.
select pg_temp.check('G10 every security definer function in public pins search_path', '0',
  (select count(*) from pg_proc
   where pronamespace = 'public'::regnamespace and prosecdef
     and not coalesce(proconfig @> array['search_path=""']
                      or proconfig @> array['search_path=pg_catalog'], false))::text);


/* ---------- Profiles ---------- */
select pg_temp.check('P1 user reads own profile', 'ok:1',
  pg_temp.attempt(pg_temp.u('m1'), format('select * from public.profiles where id = %L', pg_temp.u('m1'))));
select pg_temp.check('P2 NEGATIVE: user cannot read another profile', 'ok:0',
  pg_temp.attempt(pg_temp.u('m1'), format('select * from public.profiles where id = %L', pg_temp.u('w1'))));
select pg_temp.check('P3 NEGATIVE: user cannot create a profile for someone else', 'error',
  pg_temp.attempt(pg_temp.u('m1'), format('insert into public.profiles values (%L, ''Ali'', ''Women'')', pg_temp.u('n1'))));
select pg_temp.check('P4 NEGATIVE: user cannot change their own gender', 'error',
  pg_temp.attempt(pg_temp.u('m1'), format('update public.profiles set gender = ''Women'' where id = %L', pg_temp.u('m1'))));
select pg_temp.check('P5 NEGATIVE: user cannot delete their own profile', 'error',
  pg_temp.attempt(pg_temp.u('m1'), format('delete from public.profiles where id = %L', pg_temp.u('m1'))));
select pg_temp.check('P6 NEGATIVE: logged-out user cannot read profiles', 'error',
  pg_temp.attempt(null, 'select * from public.profiles'));
select pg_temp.check('P7 user with no profile creates their own', 'ok:1',
  pg_temp.attempt(pg_temp.u('n1'), format('insert into public.profiles values (%L, ''Ali'', ''Men'')', pg_temp.u('n1'))));
delete from public.profiles where id = pg_temp.u('n1'); -- back to "no profile" for the room checks

-- Name rule (first_name_valid). Run as admin, so only the constraint decides.
select pg_temp.check('N' || n || ' name allowed: ' || name, 'ok:1',
  pg_temp.admin(format('update public.profiles set first_name = %L where id = %L', name, pg_temp.u('m1'))))
from (values (1, 'Al'), (2, 'Abdul-Rahman'), (3, 'O''Neil'), (4, 'O’Neil'), (5, 'Mary Ann'),
             (6, 'José'), (7, 'Zoë'), (8, 'Çelik'), (9, 'Łukasz')) v(n, name);
select pg_temp.check('N' || n || ' NEGATIVE: name refused: ' || name, 'error',
  pg_temp.admin(format('update public.profiles set first_name = %L where id = %L', name, pg_temp.u('m1'))))
from (values (10, 'A'), (11, 'Ali3'), (12, 'Al  Amin'), (13, '-Ali'), (14, 'Ali-'),
             (15, 'Abcdefghijklmnopqrstu'), (16, 'Jose' || chr(769)), (17, '王'), (18, 'Ali×')) v(n, name);


/* ---------- Requests and joiners ---------- */
select pg_temp.check('R1 user posts in their own gender''s room (post_request)', 'ok:1',
  pg_temp.attempt(pg_temp.u('m1'), format('select public.post_request(%L, 10)', pg_temp.room('050'))));
select pg_temp.check('R2 post_request uses the server clock: start is 10 min from now', 'true',
  (select abs(extract(epoch from start_time - (now() + interval '10 minutes'))) < 1
   from public.requests where requester = pg_temp.u('m1'))::text);
select pg_temp.check('R3 NEGATIVE: cannot post in the other gender''s room', 'error',
  pg_temp.attempt(pg_temp.u('m2'), format('select public.post_request(%L, 10)', pg_temp.room('060'))));
select pg_temp.check('R4 NEGATIVE: cannot post as the other gender', 'error',
  pg_temp.attempt(pg_temp.u('m2'), format('insert into public.requests (room_id, requester, gender, start_time) values (%L, %L, ''Women'', now() + interval ''10 minutes'')', pg_temp.room('057'), pg_temp.u('m2'))));
select pg_temp.check('R5 NEGATIVE: cannot post as someone else', 'error',
  pg_temp.attempt(pg_temp.u('m2'), format('insert into public.requests (room_id, requester, gender, start_time) values (%L, %L, ''Men'', now() + interval ''10 minutes'')', pg_temp.room('057'), pg_temp.u('m5'))));
select pg_temp.check('R6 NEGATIVE: start time 2 min ahead refused', 'error',
  pg_temp.attempt(pg_temp.u('m2'), format('insert into public.requests (room_id, requester, gender, start_time) values (%L, %L, ''Men'', now() + interval ''2 minutes'')', pg_temp.room('057'), pg_temp.u('m2'))));
select pg_temp.check('R7 NEGATIVE: start time 50 min ahead refused', 'error',
  pg_temp.attempt(pg_temp.u('m2'), format('insert into public.requests (room_id, requester, gender, start_time) values (%L, %L, ''Men'', now() + interval ''50 minutes'')', pg_temp.room('057'), pg_temp.u('m2'))));
select pg_temp.check('R8 NEGATIVE: post_request refuses minutes that the app does not offer', 'error',
  pg_temp.attempt(pg_temp.u('m2'), format('select public.post_request(%L, 60)', pg_temp.room('057'))));
select pg_temp.check('R9 NEGATIVE: a second request is refused', 'error',
  pg_temp.attempt(pg_temp.u('m1'), format('select public.post_request(%L, 15)', pg_temp.room('057'))));
select pg_temp.check('R10 same-gender user sees the request', 'ok:1',
  pg_temp.attempt(pg_temp.u('m2'), format('select id, room_id, start_time from public.requests where id = %L', pg_temp.request_of(pg_temp.u('m1')))));
select pg_temp.check('R11 NEGATIVE: no one can read who posted (requester)', 'error',
  pg_temp.attempt(pg_temp.u('m2'), 'select requester from public.requests'));
select pg_temp.check('R12 NEGATIVE: select * fails too (it includes requester)', 'error',
  pg_temp.attempt(pg_temp.u('m1'), 'select * from public.requests'));
select pg_temp.check('R13 NEGATIVE: other gender sees none of it', 'ok:0',
  pg_temp.attempt(pg_temp.u('w1'), format('select id from public.requests where id = %L', pg_temp.request_of(pg_temp.u('m1')))));
select pg_temp.check('R14 NEGATIVE: other gender cannot join it', 'error',
  pg_temp.attempt(pg_temp.u('w1'), format('insert into public.joiners values (%L, %L)', pg_temp.u('w1'), pg_temp.request_of(pg_temp.u('m1')))));
select pg_temp.check('R15 NEGATIVE: other gender gets no count for it', 'ok:0',
  pg_temp.attempt(pg_temp.u('w1'), format('select * from public.request_count() where request_id = %L', pg_temp.request_of(pg_temp.u('m1')))));
select pg_temp.check('R16 NEGATIVE: other gender cannot delete it', 'ok:0',
  pg_temp.attempt(pg_temp.u('w1'), format('delete from public.requests where id = %L', pg_temp.request_of(pg_temp.u('m1')))));
select pg_temp.check('R17 NEGATIVE: same gender cannot delete someone else''s request', 'ok:0',
  pg_temp.attempt(pg_temp.u('m2'), format('delete from public.requests where id = %L', pg_temp.request_of(pg_temp.u('m1')))));
select pg_temp.check('R18 same gender joins it', 'ok:1',
  pg_temp.attempt(pg_temp.u('m2'), format('insert into public.joiners values (%L, %L)', pg_temp.u('m2'), pg_temp.request_of(pg_temp.u('m1')))));
select pg_temp.check('R19 NEGATIVE: cannot join as someone else', 'error',
  pg_temp.attempt(pg_temp.u('m2'), format('insert into public.joiners values (%L, %L)', pg_temp.u('m5'), pg_temp.request_of(pg_temp.u('m1')))));
select pg_temp.check('R20 NEGATIVE: cannot post while joined', 'error',
  pg_temp.attempt(pg_temp.u('m2'), format('select public.post_request(%L, 10)', pg_temp.room('057'))));
select pg_temp.check('R21 NEGATIVE: cannot join while holding a request', 'error',
  pg_temp.attempt(pg_temp.u('m1'), format('insert into public.joiners values (%L, %L)', pg_temp.u('m1'), pg_temp.request_of(pg_temp.u('m1')))));
select pg_temp.check('R22 joiner reads only their own join row', 'ok:1',
  pg_temp.attempt(pg_temp.u('m2'), 'select * from public.joiners'));
select pg_temp.check('R23 NEGATIVE: requester cannot see who joined', 'ok:0',
  pg_temp.attempt(pg_temp.u('m1'), 'select * from public.joiners'));
select pg_temp.check('R24 requester sees the count', 'ok:1',
  pg_temp.attempt(pg_temp.u('m1'), format('select * from public.request_count() where request_id = %L and count = 1', pg_temp.request_of(pg_temp.u('m1')))));

-- One role at a time, enforced by the triggers even when the policies are skipped (as admin).
select pg_temp.check('R25 NEGATIVE: trigger refuses a request for someone who has joined', 'error',
  pg_temp.admin(format('insert into public.requests (room_id, requester, gender, start_time) values (%L, %L, ''Men'', now() + interval ''10 minutes'')', pg_temp.room('057'), pg_temp.u('m2'))));
select pg_temp.check('R26 NEGATIVE: trigger refuses a join for someone holding a request', 'error',
  pg_temp.admin(format('insert into public.joiners values (%L, %L)', pg_temp.u('m1'), pg_temp.request_of(pg_temp.u('m1')))));

-- Before the cutoff, Leave and Cancel work.
select pg_temp.check('R27 joiner leaves before the cutoff', 'ok:1',
  pg_temp.attempt(pg_temp.u('m2'), format('delete from public.joiners where member = %L', pg_temp.u('m2'))));
select pg_temp.check('R28 requester cancels before the cutoff', 'ok:1',
  pg_temp.attempt(pg_temp.u('m1'), format('delete from public.requests where id = %L', pg_temp.request_of(pg_temp.u('m1')))));

-- After the cutoff (m3's request started 3 minutes ago, m4 joined), they're refused.
select pg_temp.admin(format('insert into public.requests (room_id, requester, gender, start_time) values (%L, %L, ''Men'', now() - interval ''3 minutes'')', pg_temp.room('057'), pg_temp.u('m3')));
select pg_temp.admin(format('insert into public.joiners values (%L, %L)', pg_temp.u('m4'), pg_temp.request_of(pg_temp.u('m3'))));
select pg_temp.check('R29 NEGATIVE: joiner cannot leave after the cutoff', 'ok:0',
  pg_temp.attempt(pg_temp.u('m4'), format('delete from public.joiners where member = %L', pg_temp.u('m4'))));
select pg_temp.check('R30 NEGATIVE: requester cannot cancel after the cutoff', 'ok:0',
  pg_temp.attempt(pg_temp.u('m3'), format('delete from public.requests where id = %L', pg_temp.request_of(pg_temp.u('m3')))));
select pg_temp.check('R31 NEGATIVE: cannot join after the cutoff', 'error',
  pg_temp.attempt(pg_temp.u('m5'), format('insert into public.joiners values (%L, %L)', pg_temp.u('m5'), pg_temp.request_of(pg_temp.u('m3')))));

-- Logged out: nothing.
select pg_temp.check('R32 NEGATIVE: logged-out user cannot read requests', 'error',
  pg_temp.attempt(null, 'select id from public.requests'));
select pg_temp.check('R33 NEGATIVE: logged-out user cannot read joiners', 'error',
  pg_temp.attempt(null, 'select member from public.joiners'));
select pg_temp.check('R34 NEGATIVE: logged-out user cannot post', 'error',
  pg_temp.attempt(null, format('select public.post_request(%L, 10)', pg_temp.room('057'))));
select pg_temp.check('R35 NEGATIVE: logged-out user cannot call request_count', 'error',
  pg_temp.attempt(null, 'select * from public.request_count()'));


/* ---------- Rooms and the tally ---------- */
select pg_temp.check('T1 Men user sees the Men room', 'ok:1',
  pg_temp.attempt(pg_temp.u('m1'), 'select * from public.rooms where room_num = ''050'''));
select pg_temp.check('T2 NEGATIVE: Men user does not see the Women room', 'ok:0',
  pg_temp.attempt(pg_temp.u('m1'), 'select * from public.rooms where room_num = ''060'''));
select pg_temp.check('T3 Women user sees the Women room', 'ok:1',
  pg_temp.attempt(pg_temp.u('w1'), 'select * from public.rooms where room_num = ''060'''));
select pg_temp.check('T4 NEGATIVE: Women user does not see the Men room', 'ok:0',
  pg_temp.attempt(pg_temp.u('w1'), 'select * from public.rooms where room_num = ''050'''));
select pg_temp.check('T5 user with no profile sees shared rooms', 'ok:1',
  pg_temp.attempt(pg_temp.u('n1'), 'select * from public.rooms where room_num = ''057'''));
select pg_temp.check('T6 NEGATIVE: user with no profile sees no single-gender room', 'ok:0',
  pg_temp.attempt(pg_temp.u('n1'), 'select * from public.rooms where gender is not null'));
select pg_temp.check('T7 NEGATIVE: logged-out user cannot read rooms', 'error',
  pg_temp.attempt(null, 'select * from public.rooms'));
select pg_temp.check('T8 NEGATIVE: user cannot change rooms', 'error',
  pg_temp.attempt(pg_temp.u('m1'), 'update public.rooms set is_open = false'));
select pg_temp.check('T9 NEGATIVE: user cannot read the tally', 'error',
  pg_temp.attempt(pg_temp.u('m1'), 'select * from public.congregation_tally'));
select pg_temp.check('T10 NEGATIVE: user cannot write the tally', 'error',
  pg_temp.attempt(pg_temp.u('m1'), format('insert into public.congregation_tally (room_id, day_of) values (%L, current_date)', pg_temp.room('057'))));
select pg_temp.check('T11 NEGATIVE: logged-out user cannot read the tally', 'error',
  pg_temp.attempt(null, 'select * from public.congregation_tally'));
select pg_temp.check('T12 NEGATIVE: user cannot run the expiry job', 'error',
  pg_temp.attempt(pg_temp.u('m1'), 'select public.expire_requests()'));


/* ---------- OSU email ---------- */
select pg_temp.check('E' || n || ' is_osu_email(' || coalesce(email, 'null') || ')', expected::text,
  public.is_osu_email(email)::text)
from (values (1, 'a.1@osu.edu', true), (2, 'A.1@OSU.EDU', true), (3, 'x@notosu.edu', false),
             (4, 'x@osu.edu.evil.com', false), (5, 'x@gmail.com', false), (6, null, false)) v(n, email, expected);
select pg_temp.check('E7 hook accepts an OSU address', '{}',
  public.verify_osu_email('{"user":{"email":"a.1@osu.edu"}}')::text);
select pg_temp.check('E8 NEGATIVE: hook refuses a non-OSU address', 'true',
  (public.verify_osu_email('{"user":{"email":"x@gmail.com"}}') ? 'error')::text);
select pg_temp.check('E9 NEGATIVE: hook refuses a missing email', 'true',
  (public.verify_osu_email('{"user":{}}') ? 'error')::text);
select pg_temp.check('E10 NEGATIVE: email cannot change to a non-OSU address', 'error',
  pg_temp.admin(format('update auth.users set email = ''m1@gmail.com'' where id = %L', pg_temp.u('m1'))));
select pg_temp.check('E11 NEGATIVE: a pending email change to a non-OSU address is refused', 'error',
  pg_temp.admin(format('update auth.users set email_change = ''m1@gmail.com'' where id = %L', pg_temp.u('m1'))));
select pg_temp.check('E12 a pending change to another OSU address is allowed', 'ok:1',
  pg_temp.admin(format('update auth.users set email_change = ''m1.new@osu.edu'' where id = %L', pg_temp.u('m1'))));
select pg_temp.check('E13 changing to another OSU address is allowed', 'ok:1',
  pg_temp.admin(format('update auth.users set email = ''m1.new@osu.edu'', email_change = '''' where id = %L', pg_temp.u('m1'))));
select pg_temp.check('E' || n || ' is_osu_email(' || email || ')', expected::text, public.is_osu_email(email)::text)
from (values (14, 'x@evil.com@osu.edu', false), (15, 'x y@osu.edu', false), (16, '@osu.edu', false),
             (17, 'x@osu.edu' || chr(10), false), (18, 'a.1+tag@osu.edu', true)) v(n, email, expected);
select pg_temp.check('E19 NEGATIVE: hook refuses an address with two @', 'true',
  (public.verify_osu_email('{"user":{"email":"x@evil.com@osu.edu"}}') ? 'error')::text);
select pg_temp.check('E20 NEGATIVE: email cannot change to an address with two @', 'error',
  pg_temp.admin(format('update auth.users set email = ''x@evil.com@osu.edu'' where id = %L', pg_temp.u('m1'))));
-- The App Review exception: exactly one address, nothing near it.
select pg_temp.check('E' || n || ' is_osu_email(' || email || ')', expected::text, public.is_osu_email(email)::text)
from (values (21, 'review@saffbuddy.app', true), (22, 'Review@SaffBuddy.app', true),
             (23, 'review2@saffbuddy.app', false), (24, 'xreview@saffbuddy.app', false),
             (25, 'support@saffbuddy.app', false), (26, 'review@saffbuddy.app.evil.com', false),
             (27, 'review@saffbuddy.app ', false), (28, 'x@review@saffbuddy.app', false)) v(n, email, expected);
select pg_temp.check('E29 hook accepts the review address', '{}',
  public.verify_osu_email('{"user":{"email":"review@saffbuddy.app"}}')::text);
select pg_temp.check('E30 NEGATIVE: hook refuses another saffbuddy.app address', 'true',
  (public.verify_osu_email('{"user":{"email":"support@saffbuddy.app"}}') ? 'error')::text);
select pg_temp.check('E31 NEGATIVE: email cannot change to another saffbuddy.app address', 'error',
  pg_temp.admin(format('update auth.users set email = ''x@saffbuddy.app'' where id = %L', pg_temp.u('m1'))));
select pg_temp.check('E32 NEGATIVE: a pending email change to another saffbuddy.app address is refused', 'error',
  pg_temp.admin(format('update auth.users set email_change = ''x@saffbuddy.app'' where id = %L', pg_temp.u('m1'))));


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

/* Checks for supabase/delete_account.sql. Run the whole file in the SQL Editor.
   It tests the function as deployed (it no longer re-creates its own copy, which could hide a
   bad change) and ends in rollback, so the fake users and deletions aren't saved.
   "Success. No rows returned" = every check passed; a failure stops with "FAIL: <checks>".

   Fake users (all Men, room 057):
     d1 = requester of R1, which d2 joined     -> d1 deletes their account
     d3 = requester of R3, which d4 joined     -> d4 deletes their account
   Expected results: every row says pass. */
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'd1@osu.edu'),
  ('00000000-0000-0000-0000-0000000000d2', 'd2@osu.edu'),
  ('00000000-0000-0000-0000-0000000000d3', 'd3@osu.edu'),
  ('00000000-0000-0000-0000-0000000000d4', 'd4@osu.edu');
insert into public.profiles (id, first_name, gender) values
  ('00000000-0000-0000-0000-0000000000d1', 'Test', 'Men'),
  ('00000000-0000-0000-0000-0000000000d2', 'Test', 'Men'),
  ('00000000-0000-0000-0000-0000000000d3', 'Test', 'Men'),
  ('00000000-0000-0000-0000-0000000000d4', 'Test', 'Men');
-- Inserted as postgres, so the insert policies' time window doesn't apply.
insert into public.requests (id, room_id, requester, gender, start_time) values
  ('40000000-0000-0000-0000-0000000000a1', (select id from public.rooms where room_num = '057'),
   '00000000-0000-0000-0000-0000000000d1', 'Men', now() + interval '10 minutes'),
  ('40000000-0000-0000-0000-0000000000a3', (select id from public.rooms where room_num = '057'),
   '00000000-0000-0000-0000-0000000000d3', 'Men', now() + interval '10 minutes');
insert into public.joiners (member, request_id) values
  ('00000000-0000-0000-0000-0000000000d2', '40000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000d4', '40000000-0000-0000-0000-0000000000a3');

-- Tally before, to prove deleting accounts doesn't change it.
create temp table base as
  select count(*) as n, coalesce(sum(congregations), 0) as c, coalesce(sum(buddies), 0) as b
  from public.congregation_tally;

-- Anonymous caller: must be refused outright. The error is caught so the transaction keeps going.
set local role anon;
do $$
begin
  perform public.delete_my_account();
  perform set_config('test.anon', 'allowed', true);
exception when insufficient_privilege then
  perform set_config('test.anon', 'denied', true);
end $$;
reset role;

-- d1 (a requester) deletes their account, as the app would: signed in as d1.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
set local role authenticated;
select public.delete_my_account();
reset role;

-- d4 (a joiner) deletes their account.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated"}', true);
set local role authenticated;
select public.delete_my_account();
reset role;

create temp table results (test text, expected text, actual text);
insert into results select '1 NEGATIVE: anon is refused', 'denied', current_setting('test.anon', true);
insert into results select '2 d1 auth user deleted', '0',
  (select count(*) from auth.users where id = '00000000-0000-0000-0000-0000000000d1')::text;
insert into results select '3 d1 profile deleted (cascade)', '0',
  (select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000d1')::text;
insert into results select '4 d1 request R1 deleted (cascade)', '0',
  (select count(*) from public.requests where id = '40000000-0000-0000-0000-0000000000a1')::text;
insert into results select '5 d2 join on R1 deleted (cascade)', '0',
  (select count(*) from public.joiners where member = '00000000-0000-0000-0000-0000000000d2')::text;
insert into results select '6 NEGATIVE: d2 account untouched', '1',
  (select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000d2')::text;
insert into results select '7 NEGATIVE: d3 account untouched', '1',
  (select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000d3')::text;
insert into results select '8 d4 join on R3 deleted (cascade)', '0',
  (select count(*) from public.joiners where member = '00000000-0000-0000-0000-0000000000d4')::text;
insert into results select '9 NEGATIVE: d3 request R3 survives a joiner leaving', '1',
  (select count(*) from public.requests where id = '40000000-0000-0000-0000-0000000000a3')::text;
insert into results select '11 function is security definer with search_path pinned', 'true',
  (select prosecdef and proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.delete_my_account()'::regprocedure)::text;
insert into results select '12 NEGATIVE: anon has no execute on it', 'false',
  has_function_privilege('anon', 'public.delete_my_account()', 'EXECUTE')::text;
insert into results select '10 tally unchanged', (select n || '/' || c || '/' || b from base),
  (select count(*) || '/' || coalesce(sum(congregations), 0) || '/' || coalesce(sum(buddies), 0)
   from public.congregation_tally);

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

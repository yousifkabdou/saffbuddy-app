/* Security hardening, 2026-11-23. Run ONCE on the live project in the SQL Editor, as a whole.
   It's safe to run again: every step replaces or re-creates its object.

   Before running it: the checks in supabase/tests/ pass locally (npm test runs them on a
   local Postgres with the schema files plus this migration).
   After running it: run supabase/tests/security_checks.sql in the SQL Editor; every row should
   say pass, and the last statement raises an error naming any check that failed.

   What changes for who can see or write what:
   1. Grants: revoke everything from anon/authenticated, then grant exactly what the app uses.
      Closes a possible leak of requests.requester (who posted) if Supabase's default grants were there.
   2. Names may contain accented Latin letters.
   3. An account's email can't be changed to a non-OSU address.
   4. Cancel and Leave are refused after the join cutoff (start + 2 minutes).
   5. post_request(): the server sets start_time (the policy still checks everything).
   6. A user can't become requester and joiner at once by doing both at the same instant.
   7. expire_requests() locks the rows it counts, so a mid-run Leave/Cancel can't skew the tally.
   (2026-11-25: is_osu_email below was tightened to match verify_osu_email.sql. To apply just that
   on the live project, run verify_osu_email.sql again; it's safe to re-run.) */

begin;

-- 1. Grants
revoke all on public.profiles, public.requests, public.joiners, public.rooms, public.congregation_tally
  from anon, authenticated;
grant insert, select on public.profiles to authenticated;
grant insert, delete on public.requests to authenticated;
grant select (id, room_id, start_time, gender) on public.requests to authenticated;
grant select, delete, insert on public.joiners to authenticated;
grant select on public.rooms to authenticated;

-- 2. Names
alter table public.profiles drop constraint if exists first_name_valid;
alter table public.profiles add constraint first_name_valid check (
    char_length(first_name) between 2 and 20
    and first_name ~ '^[A-Za-zÀ-ÖØ-öø-ÿĀ-ſ]+([ ''’-][A-Za-zÀ-ÖØ-öø-ÿĀ-ſ]+)*$'
);

-- 3. OSU email: shared check, hook, email-change trigger
create or replace function public.is_osu_email(email text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(email ~* '^[^@\s]+@osu\.edu$', false)
$$;

revoke execute on function public.is_osu_email(text) from public, anon, authenticated;
grant execute on function public.is_osu_email(text) to supabase_auth_admin;

create or replace function public.verify_osu_email(info jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  if public.is_osu_email(info -> 'user' ->> 'email') then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object('error',
    jsonb_build_object('http_code', 400, 'message', 'Invalid email, only "@osu.edu emails" are allowed to sign up')
  );
end;
$$;
-- Grant access to function to supabase_auth_admin
grant execute on function public.verify_osu_email to supabase_auth_admin;

-- Grant access to schema to supabase_auth_admin
grant usage on schema public to supabase_auth_admin;

-- Revoke function permissions from authenticated, anon and public
revoke execute on function public.verify_osu_email from authenticated, anon, public;

/* Email changes. Supabase Auth first saves the new address in email_change (pending),
   then moves it into email once confirmed; both are checked, so a non-OSU change is refused
   right when it's asked for. Raising here makes Auth return an error to the caller.
   security definer: it runs as the user Auth connects as, and only needs to call is_osu_email. */
create or replace function public.keep_osu_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email and new.email is not null
     and not public.is_osu_email(new.email) then
    raise exception 'Only @osu.edu email addresses are allowed' using errcode = 'check_violation';
  end if;
  if new.email_change is distinct from old.email_change and coalesce(new.email_change, '') <> ''
     and not public.is_osu_email(new.email_change) then
    raise exception 'Only @osu.edu email addresses are allowed' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.keep_osu_email() from public, anon, authenticated;

drop trigger if exists keep_osu_email on auth.users;
create trigger keep_osu_email
before update of email, email_change on auth.users
for each row execute function public.keep_osu_email();

-- 4. Cancel / Leave only before the join cutoff
drop policy if exists "user can only delete their request" on public.requests;
drop policy if exists "requesters cancel only before the join cutoff" on public.requests;
drop policy if exists "joiners can delete their request" on public.joiners;
drop policy if exists "joiners leave only before the join cutoff" on public.joiners;
create policy "requesters cancel only before the join cutoff"
on public.requests
for delete
to authenticated
using (requester = auth.uid() and start_time > now() - interval '2 minutes');

create policy "joiners leave only before the join cutoff"
on public.joiners
for delete
to authenticated
using (member = auth.uid()
and (select start_time from public.requests where id = request_id) > now() - interval '2 minutes');

-- 5 and 6. post_request() and one-role triggers
create or replace function public.post_request(room uuid, minutes integer)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if minutes is null or minutes not in (5, 10, 15, 30, 45) then
    raise exception 'minutes must be 5, 10, 15, 30 or 45' using errcode = '22023';
  end if;
  insert into public.requests (room_id, requester, gender, start_time)
  values (room, auth.uid(), (select gender from public.profiles where id = auth.uid()),
          now() + make_interval(mins => minutes))
  returning id into new_id;
  return new_id;
end;
$$;

revoke execute on function public.post_request(uuid, integer) from public, anon;
grant execute on function public.post_request(uuid, integer) to authenticated;


/* ---------- One role at a time ----------
   The policies say "can't post while joined" and "can't join while holding a request", but each
   only sees rows already committed. Two inserts at the same instant (two phones, or a script)
   would both pass. These triggers take a per-user lock first, so the second insert waits for the
   first to finish, then check again and see it.
   security definer: the check must see the user's row in the other table whatever its policies. */
create or replace function public.one_role_on_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('saffbuddy-member:' || new.requester::text));
  if exists (select 1 from public.joiners where member = new.requester) then
    raise exception 'Already joined a request' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function public.one_role_on_join()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('saffbuddy-member:' || new.member::text));
  if exists (select 1 from public.requests where requester = new.member) then
    raise exception 'Already holding a request' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.one_role_on_request() from public, anon, authenticated;
revoke execute on function public.one_role_on_join() from public, anon, authenticated;

drop trigger if exists one_role_on_request on public.requests;
create trigger one_role_on_request
before insert on public.requests
for each row execute function public.one_role_on_request();

drop trigger if exists one_role_on_join on public.joiners;
create trigger one_role_on_join
before insert on public.joiners
for each row execute function public.one_role_on_join();

-- 7. Expiry job
create or replace function public.expire_requests()
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform 1 from public.requests
  where start_time <= now() - interval '10 minutes'
  for update;
  perform 1 from public.joiners
  where request_id in (select id from public.requests where start_time <= now() - interval '10 minutes')
  for update;

  insert into public.congregation_tally (room_id, day_of, congregations, buddies)
  select
    r.room_id,
    (r.start_time at time zone 'America/New_York')::date,
    count(distinct r.id),                    -- one congregation per request
    count(distinct r.id) + count(j.member)   -- requesters + joiners
  from public.requests r
  join public.joiners j on j.request_id = r.id  -- inner join: 0 joiners = not counted
  where r.start_time <= now() - interval '10 minutes'
  group by r.room_id, (r.start_time at time zone 'America/New_York')::date
  on conflict (room_id, day_of) do update
    set congregations = public.congregation_tally.congregations + excluded.congregations,
        buddies = public.congregation_tally.buddies + excluded.buddies;

  delete from public.requests
  where start_time <= now() - interval '10 minutes';
end;
$$;

revoke execute on function public.expire_requests() from anon, authenticated, public;

commit;

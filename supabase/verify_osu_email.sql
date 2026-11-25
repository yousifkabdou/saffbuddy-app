/* OSU-only accounts (plus one App Review account, below). Two places need the same rule, so it
   lives in one function:
   - verify_osu_email: the "Before User Created" Auth hook (Dashboard -> Authentication -> Hooks)
   - keep_osu_email: a trigger that stops an existing account changing its email to a
     non-OSU address (supabase.auth.updateUser({ email }) never calls the sign-up hook).
   The app has its own copy (isOsuEmail in src/lib/authErrors.ts) only to show a nicer message. */

-- true only for <one or more non-@, non-space characters>@osu.edu (any case). null/missing -> false.
-- Anchored at both ends, so x@evil.com@osu.edu (two @), "x y@osu.edu", notosu.edu and
-- osu.edu.evil.com don't match. Same rule as isOsuEmail in src/lib/authErrors.ts, plus the
-- exception below (the app checks that one separately, with isReviewEmail).
-- One exception: review@saffbuddy.app, the account Apple's App Review signs in with (password,
-- set in the dashboard; see REVIEW_EMAIL in authErrors.ts). Exact match only, and only whoever
-- reads that inbox (the developer) could ever get a code for it.
create or replace function public.is_osu_email(email text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(email ~* '^[^@\s]+@osu\.edu$' or lower(email) = 'review@saffbuddy.app', false)
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

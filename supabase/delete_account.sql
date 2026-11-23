/* In-app account deletion (required by the App Store).

   Deletes the caller's own auth.users row. Everything else goes with it through the
   existing "on delete cascade" foreign keys:
     auth.users -> profiles -> requests (their own request) -> joiners (everyone who joined it)
                            -> joiners (their own join on someone else's request)
   congregation_tally has no link to users, so the anonymous counts are untouched (docs/adr/0001).

   Why security definer: users have no rights on auth.users, so the function runs with its
   owner's rights. It is safe because it takes no arguments: the only row it can delete is
   auth.uid(), which comes from the caller's signed login token and can't be faked.

   Accepted limitation: nothing remembers a deleted account (keeping the email would be stored
   identity data), so someone can delete their account, sign up again with the same email, and
   choose a different gender. Gender separation still holds for every account that exists. */
create or replace function public.delete_my_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

-- Postgres lets everyone (public) execute new functions by default. Only signed-in users may.
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

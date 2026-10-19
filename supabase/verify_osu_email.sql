
create or replace function public.verify_osu_email(info jsonb)
returns jsonb
language plpgsql
as $$
declare
  email text;
begin
  email := lower(info -> 'user' ->> 'email');
  
  if email like '%@osu.edu' then
  return '{}':: jsonb;
  end if;

  return jsonb_build_object('error',
  jsonb_build_object ('http_code', 400, 'message', 'Invalid email, only "@osu.edu emails" are allowed to sign up' )
  );

end;
$$;
-- Grant access to function to supabase_auth_admin
grant execute on function public.verify_osu_email to supabase_auth_admin;

-- Grant access to schema to supabase_auth_admin
grant usage on schema public to supabase_auth_admin;

-- Revoke function permissions from authenticated, anon and public
revoke execute on function public.verify_osu_email from authenticated, anon, public;
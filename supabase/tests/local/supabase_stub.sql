/* A minimal stand-in for the parts of Supabase our schema uses, so the schema files and
   the checks in supabase/tests/ can run in a local Postgres (PGlite, in npm test).
   Only for local tests; never run this on the real project.

   It copies the Supabase behaviour that matters for security:
   - the roles anon, authenticated, service_role, supabase_auth_admin
   - auth.uid() read from the request.jwt.claims setting, like PostgREST sets it
   - Supabase's default privileges: every new table in public gets ALL for anon and
     authenticated. That's why our files must revoke before they grant.
   - Postgres's default: every new function is executable by public. */

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role supabase_auth_admin nologin;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

-- auth: just the columns our SQL touches.
create schema auth;
grant usage on schema auth to anon, authenticated, supabase_auth_admin;
create table auth.users (
  id uuid primary key,
  email text,
  email_change text default ''
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid
$$;
grant execute on function auth.uid() to public;

-- realtime: messages + send() + topic(), as used by supabase/live_updates.sql.
create schema realtime;
grant usage on schema realtime to anon, authenticated;
create table realtime.messages (
  id bigserial primary key,
  topic text not null,
  extension text not null,
  event text,
  payload jsonb,
  private boolean default false,
  inserted_at timestamptz default now()
);
alter table realtime.messages enable row level security;
grant select, insert on realtime.messages to anon, authenticated;
create function realtime.topic() returns text language sql stable as $$
  select nullif(current_setting('realtime.topic', true), '')
$$;
create function realtime.send(payload jsonb, event text, topic text, private boolean default true)
returns void language sql as $$
  insert into realtime.messages (topic, extension, event, payload, private)
  values (topic, 'broadcast', event, payload, private)
$$;

-- pg_cron: schedule() is a no-op here; tests call expire_requests() directly.
create schema cron;
create function cron.schedule(job_name text, schedule text, command text) returns bigint
language sql as $$ select 1::bigint $$;

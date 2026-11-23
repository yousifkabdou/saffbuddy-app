create table requests(
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  requester uuid not null references profiles(id) on delete cascade unique,
  gender text not null check (gender in ('Men' , 'Women')),
  start_time timestamptz  not null
);

alter table requests enable row level security;

/* Revoke first: Supabase's default privileges give anon and authenticated every privilege
   on new tables, and a table-wide select would cover every column, including requester.
   requester is left out of the select grant on purpose: no one can read who posted
   (a user id is a stable pseudonym that would reveal someone's prayer pattern). */
revoke all on requests from anon, authenticated;
grant insert, delete on requests to authenticated;
grant select (id, room_id, start_time, gender) on requests to authenticated;

/* The insert policy is in joins.sql: it calls check_for_member_request(), which needs the
   joiners table, and joiners needs this table. Run the files in the order the README lists. */

create policy "read same gender as user"
on requests
for select
to authenticated
using (gender = (select gender from profiles where id = auth.uid()));

/* Cancelling is allowed only until the join cutoff (start + 2 min, the same interval as the
   joiners insert policy). After that the prayer is happening; deleting it then would keep it
   out of the tally (docs/adr/0001), so the app offers Done instead. Changed 2026-11-23. */
create policy "requesters cancel only before the join cutoff"
on requests
for delete
to authenticated
using (requester = auth.uid() and start_time > now() - interval '2 minutes');

/* No update: to change a request, cancel it and post a new one */

/* Expiry: a pg_cron job (supabase/expiry.sql) deletes requests 10 minutes
   after their start time and adds them to the per-room daily tally
   (docs/adr/0001), so no request history is kept. */

/* Returns the caller's own request id (or null), so the app can mark it "Yours"
   without being able to read anyone's requester column */
create or replace function public.my_request_id()
returns uuid
language sql
security definer
set search_path = ''
as $$
  select id from public.requests where requester = auth.uid()
$$;

revoke execute on function public.my_request_id() from public, anon;
grant execute on function public.my_request_id() to authenticated;

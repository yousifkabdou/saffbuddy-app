create table requests(
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  requester uuid not null references profiles(id) on delete cascade unique,
  gender text not null check (gender in ('Men' , 'Women')),
  start_time timestamptz  not null
);

alter table requests enable row level security;

grant insert, delete on requests to authenticated;
grant select (id, room_id, start_time, gender) on requests to authenticated;


create policy "only insert as self, start time 5 to 45 mins ahead"
on requests
for insert
to authenticated
with check (gender = (select gender from profiles where id = auth.uid())
and (start_time between now() + interval '4 minutes' and now() + interval '46 minutes') -- app offers 5-45 min; 1 min slack each side for request delay
and requester = auth.uid()
and (gender = (select gender from rooms where id = requests.room_id) or exists (select gender from rooms where id = requests.room_id and gender is null))
and (public.check_for_member_request() is null)
);

create policy "read same gender as user"
on requests
for select
to authenticated
using (gender = (select gender from profiles where id = auth.uid()));

create policy "user can only delete their request"
on requests
for delete
to authenticated
using (requester = (auth.uid()));

/* No update: to change a request, cancel it and post a new one */

/* Expiry: a pg_cron job (supabase/expiry.sql) deletes requests 17 minutes
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

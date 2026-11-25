/* Deletes requests 10 minutes after their start time. Before deleting, each
   expiring request with at least one joiner adds 1 congregation and its
   headcount (requester + joiners) to that room's tally for that day
   (docs/adr/0001). Requests with no joiners are deleted without counting.
   Joiners are removed by on delete cascade.

   10 minutes: about 6 for the prayer plus 4, so someone who prayed a missed
   prayer can post or join the next one soon after (changed from 17 on 2026-11-21).
   The app hides requests at EXPIRY_MINUTES (8, in src/lib/requestTime.ts), so
   they disappear from screens before the server deletes them. Keep this larger
   than EXPIRY_MINUTES.

   Not security definer: pg_cron runs it as postgres, which already bypasses RLS.
   Keeping the count and the delete in step: now() is fixed for the transaction, but each
   statement sees the data as it is when that statement starts. So the first step locks the
   expiring requests and their joiners. A Leave, Cancel or account deletion that arrives
   mid-run waits until the run finishes, and the insert and the delete see the same rows.
   (Since 2026-11-23 the delete policies also refuse Leave/Cancel after start + 2 min.) */
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

select cron.schedule(
  'expire-requests',
  '* * * * *',  -- every minute
  $$select public.expire_requests()$$
);

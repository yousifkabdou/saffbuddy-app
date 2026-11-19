/* Live updates (#7): "ping, then refetch".

   When a request or join is added or removed, the database sends an EMPTY
   broadcast ("changed") to the private Realtime channel for that request's
   gender: 'requests:Men' or 'requests:Women'. The app hears the ping and
   re-runs its normal queries, which go through the usual RLS. The ping carries
   no data, so even a misdelivered ping reveals nothing.

   Why not plain postgres_changes: joiners' select policy only shows a user
   their own row (others' joins would never arrive), and delete events skip RLS
   and carry the primary key, which for joiners is the member's user id.

   Dashboard: Realtime Settings -> "Allow public access" must be OFF, so every
   channel goes through the policy below. */


-- 1. Sending: one trigger function for both tables.
--    security definer: the user whose insert/delete fired the trigger has no
--    right to write to realtime.messages; the function's owner does.
--    search_path = '': a security definer function runs with its owner's
--    privileges, so every name is schema-qualified and nothing is looked up
--    through a search path a caller could change.
create or replace function public.ping_request_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_gender text;
  joined_request uuid;
begin
  if tg_table_name = 'requests' then
    if tg_op = 'DELETE' then
      request_gender := old.gender;
    else
      request_gender := new.gender;
    end if;
  else -- joiners: no gender column, look it up through the request
    if tg_op = 'DELETE' then
      joined_request := old.request_id;
    else
      joined_request := new.request_id;
    end if;
    select gender into request_gender from public.requests where id = joined_request;
  end if;

  -- null when a request's deletion cascades to its joiners: the request row is
  -- already gone, and the requests trigger has already pinged that gender.
  if request_gender is not null then
    perform realtime.send('{}'::jsonb, 'changed', 'requests:' || request_gender, true);
  end if;

  return null; -- after trigger: the return value is ignored
end;
$$;

revoke execute on function public.ping_request_change() from public, anon, authenticated;

-- Insert and delete only: nobody has update on requests or joiners (cancel is a
-- delete). If an update grant is ever added, add "or update" here too.
create trigger ping_on_request_change
after insert or delete on public.requests
for each row execute function public.ping_request_change();

create trigger ping_on_join_change
after insert or delete on public.joiners
for each row execute function public.ping_request_change();


-- 2. Receiving: a user may listen only to their own gender's channel.
--    Gender comes from profiles (the user can read only their own row, and
--    profiles has no update grant), never from the channel name the app asks
--    for: asking for the other gender's channel just fails this check.
--    extension = 'broadcast' limits the policy to broadcast, not presence.
--    No insert policy: users can't send messages on these channels.
create policy "users receive pings for their own gender"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (select realtime.topic()) = 'requests:' || (select gender from public.profiles where id = (select auth.uid()))
);

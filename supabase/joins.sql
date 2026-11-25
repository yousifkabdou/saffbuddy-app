create table joiners(

member uuid primary key not null references profiles(id) on delete cascade,
request_id uuid not null references requests(id) on delete cascade
);
 alter table joiners enable row level security;

 -- Revoke first (see requests.sql): Supabase's default privileges would otherwise allow update too.
 revoke all on joiners from anon, authenticated;
 grant select, delete, insert on joiners to authenticated;

/* Leaving is allowed only until the join cutoff, like cancelling (see requests.sql).
   The subquery runs with the caller's own rights; a joiner can always see the request they joined. */
create policy "joiners leave only before the join cutoff"
on joiners
for delete
to authenticated
using (member = auth.uid()
and (select start_time from requests where id = request_id) > now() - interval '2 minutes');

create policy "Insert as self, same gender, no existing request "
on joiners
for insert
to authenticated
with check (member = auth.uid()
and my_request_id() is null
and ( select gender from requests where id = request_id ) = ( select gender from profiles where id = auth.uid() )
and (now() - interval '2 minutes' < (select start_time from requests where id = request_id))
);

create policy "users can only read their own rows"
on joiners
for select
to authenticated
using (member = auth.uid());


create or replace function public.request_count()
returns table(request_id uuid, count bigint)
language sql
security definer
set search_path = ''
as $$
select request_id, count(*)
from public.joiners
join public.requests on request_id = id
where requests.gender = (select gender from public.profiles where id = auth.uid())
group by request_id
$$;

grant execute on function public.request_count() to authenticated;
revoke execute on function public.request_count() from anon, public;

/*
returns the member's request id(join id) or null if it doesnt exist
*/
create or replace function public.check_for_member_request()
returns uuid
language sql
security definer
set search_path = ''
as $$
select request_id from public.joiners where member = auth.uid()
$$;

grant execute on function public.check_for_member_request() to authenticated;
revoke execute on function public.check_for_member_request() from anon, public;


/* ---------- Posting a request ----------
   Lives here, not in requests.sql, because it needs check_for_member_request() above. */

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

/* The app posts through this, so the start time comes from the server's clock, not the
   phone's (a phone a couple of minutes off would fall outside the policy's window).
   Not security definer on purpose: it runs as the caller, so the insert policy above
   still checks gender, room and everything else. It only fills in the values.
   minutes must be one of START_OFFSETS in src/lib/requestTime.ts. */
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

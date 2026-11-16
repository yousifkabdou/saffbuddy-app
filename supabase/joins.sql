create table joiners(

member uuid primary key not null references profiles(id) on delete cascade,
request_id uuid not null references requests(id) on delete cascade
);
 alter table joiners enable row level security;

 grant select, delete, insert on joiners to authenticated;

 create policy "joiners can delete their request"
 on joiners
 for delete
 to authenticated
 using (member = auth.uid());

create policy "Insert as self, same gender, no existing request "
on joiners
for insert
to authenticated
with check (member = auth.uid()
and my_request_id() is null
and ( select gender from requests where id = request_id ) = ( select gender from profiles where id = auth.uid() ));

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
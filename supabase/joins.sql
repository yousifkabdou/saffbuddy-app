create table joiners(

member uuid primary key not null references profiles(id) on delete cascade,
request_id uuid not null references requests(id) on delete cascade
);
 alter table joiners enable row level security;

 grant select, delete, insert on joiners to authenticated;

create policy "Insert as self, same gender, no existing request "
on joiners
for insert
to authenticated
with check (member = auth.uid()
and my_request_id() is null
and ( select gender from requests where id = request_id ) = ( select gender from profiles where id = auth.uid() ));


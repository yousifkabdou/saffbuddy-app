create table rooms(
  id uuid primary key default gen_random_uuid(),
  gender text check (gender in ('Men', 'Women')),
  building text not null,
  is_open boolean not null,
  floor text not null,
  room_num text not null,
  latitude double precision not null,
  longitude double precision not null
);

alter table rooms enable row level security;

grant select on rooms to authenticated;

create policy "users read shared rooms and their own gender's rooms"
on rooms
for select
to authenticated
using (gender = (select gender from profiles where id = auth.uid())
or gender is null);

/* No insert, update or delete: only the admin changes rooms */

insert into rooms (building, is_open, floor, room_num, gender, latitude, longitude)
values
  ('Thompson Library', true, 'Ground Floor', '057', null, 39.999280, -83.014982),
  ('18th Ave Library', true, 'Basement', '060', 'Men', 40.00167230845607, -83.01319747068368),
  ('18th Ave Library', true, 'Basement', '050', 'Women', 40.00167230845607, -83.01319747068368);

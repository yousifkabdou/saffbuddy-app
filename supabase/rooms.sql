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
  ('18th Ave Library', true, 'Basement', '060', 'Women', 40.00167230845607, -83.01319747068368),
  ('18th Ave Library', true, 'Basement', '050', 'Men', 40.00167230845607, -83.01319747068368);

/* Added 2026-11-19: central-campus prayer, meditation and wellness spaces from
   https://ehe.osu.edu/prayer-meditation-and-wellness-spaces (more of that list may be added later).
   Floor comes from the room number's first digit. Coordinates are building-level, from OpenStreetMap.
   The page gives no gender, so every room is shared (gender null). */
insert into rooms (building, is_open, floor, room_num, gender, latitude, longitude)
values
  ('Agricultural Administration', true, 'Ground Floor', '038', null, 40.0054711, -83.0270647),
  ('Gerlach Hall', true, '2nd Floor', '223D', null, 40.0048745, -83.0148166),
  ('Knowlton Hall', true, '1st Floor', '178', null, 40.0035981, -83.0165904),
  ('Arps Hall', true, '1st Floor', '191', null, 40.0019522, -83.0096785),
  ('Denney Hall', true, '5th Floor', '507', null, 40.0013086, -83.0125338),
  ('Dulles Hall', true, '2nd Floor', '224', null, 40.0011018, -83.0144073),
  ('University Hall', true, '2nd Floor', '237', null, 40.0005434, -83.0143337),
  ('PAES Building', true, '2nd Floor', 'A225', null, 39.9996786, -83.0173334),
  ('Ohio Union', true, '3rd Floor', '3020C', null, 39.9976645, -83.0085472);

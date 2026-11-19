create table congregation_tally(
    room_id uuid not null references rooms(id),
    day_of date not null,
    congregations integer default 0 not null,
    buddies integer default 0 not null,
    primary key (room_id, day_of)
);

alter table congregation_tally enable row level security;


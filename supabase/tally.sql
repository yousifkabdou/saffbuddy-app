create table congregation_tally(
    room_id uuid not null references rooms(id),
    day_of date not null,
    congregations integer default 0 not null,
    buddies integer default 0 not null,
    primary key (room_id, day_of)
);

alter table congregation_tally enable row level security;

/* No policies and no grants, on purpose: only the expiry job (as postgres) writes it, and only
   the admin reads it in the dashboard. Adding a policy would also need a grant, because the
   revoke below removes Supabase's default ones. See docs/adr/0001. */
revoke all on congregation_tally from anon, authenticated;


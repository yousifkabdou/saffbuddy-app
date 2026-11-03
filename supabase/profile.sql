create table profiles(
    id uuid primary key references auth.users(id) on delete cascade,
    first_name text not null,
    gender text not null check (gender in ('Men', 'Women'))
);

alter table profiles enable row level security;

grant insert, select on profiles to authenticated;

create policy "logged-in users read only their own row"
on profiles
for select
to authenticated
using (id = auth.uid());

create policy "logged-in users create only their own row"
on profiles
for insert
to authenticated
with check (id = auth.uid());
/* No delete: user would just be able to go back to setup and change their gender
No update: the user would just be able to update their gender. */

-- Same name rule as setup.tsx, enforced here so a script can't skip it
alter table profiles add constraint first_name_valid check (
    char_length(first_name) between 2 and 20
    and first_name ~ '^[A-Za-z]+([ ''’-][A-Za-z]+)*$'
);
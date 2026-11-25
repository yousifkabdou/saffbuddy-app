create table profiles(
    id uuid primary key references auth.users(id) on delete cascade,
    first_name text not null,
    gender text not null check (gender in ('Men', 'Women'))
);

alter table profiles enable row level security;

/* Supabase gives anon and authenticated every privilege on new tables by default,
   so a grant alone limits nothing: revoke everything first, then grant only what's needed.
   No update and no delete grant, on purpose: gender must never change, because every
   gender-separation rule (requests, joiners, rooms, live pings) reads it from here. */
revoke all on profiles from anon, authenticated;
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

/* Same name rule as src/lib/name.ts, enforced here so a script can't skip it.
   Letters: A-Z plus Latin letters with accents (À-ÖØ-öø-ÿ skips × and ÷; Ā-ſ is Latin Extended-A).
   The app saves names in NFC form, so "é" is one character, which is what this matches.
   Changed 2026-11-23 to allow accents. */
alter table profiles add constraint first_name_valid check (
    char_length(first_name) between 2 and 20
    and first_name ~ '^[A-Za-zÀ-ÖØ-öø-ÿĀ-ſ]+([ ''’-][A-Za-zÀ-ÖØ-öø-ÿĀ-ſ]+)*$'
);

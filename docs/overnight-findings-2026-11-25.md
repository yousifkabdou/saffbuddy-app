# Overnight findings, 2026-11-25

Report-only: no app code was changed. New tests live on branch `test/overnight-hunt` (uncommitted).
Severity: **high** (security/privacy hole, data loss, crash), **medium** (wrong behaviour a user
will hit), **low** (edge case, robustness).

## Summary

Run: 00:30 to 08:42 ET. About 110 new edge-case tests across 5 new files, plus one SQL check file
registered in `run-sql-checks.mjs`. The full suite was re-run every 30 minutes overnight (16 runs) to
catch tests that only fail at certain hours. Results were the same every time.

- **Confirmed findings:** high 0, medium 0, low 0.
- **Unconfirmed:** 1 low (`is_osu_email` accepts an address with two `@`; likely not exploitable).
  **Fixed after the run (2026-11-25):** `is_osu_email` tightened to `^[^@\s]+@osu\.edu$`; O31 and new
  checks E14-E20 pass.
- **Top 3 to act on:**
  1. Decide on O31: tighten `is_osu_email` (and `isOsuEmail`) to `^[^@\s]+@osu\.edu$`, or change
     the test's expected value. It's the only failing test, so `npm test` and CI fail until you decide.
  2. Keep `sqlDrift.test.ts`: it's the only thing stopping the migration's copies of the functions
     and policies from silently drifting away from the schema files.
  3. Optional: add `timeEdgeCases.test.ts` to the zones in `scripts/jest/other-time-zones.js` (it
     passed in 5 extra zones by hand), at the cost of about 15 s more CI time per zone.
- **Final results (08:42 ET):** `npm run typecheck` clean; `npm run lint` clean; `npm test`: Jest
  203/203 pass, time-zone reruns 4×7 pass, SQL checks pass except O31.
- **Still needs a phone check:** Postgres sends start times with 6 decimal places of seconds. Node
  parses them fine (tested), but Hermes, the phone's JavaScript engine, wasn't tested. Post a request
  and confirm its time shows correctly and it disappears 8 minutes after it starts.
- Files: `supabase/tests/overnight_checks.sql`, `src/lib/__tests__/{timeEdgeCases,overnightEdgeCases,
  sqlDrift,fetchWithTimeout}.test.ts`, one changed line in `supabase/tests/run-sql-checks.mjs`.
  All uncommitted on `test/overnight-hunt`.

## Confirmed findings

None.

## Unconfirmed

- **FIXED after the run.** **[low] `is_osu_email` accepts `x@evil.com@osu.edu`**: `supabase/verify_osu_email.sql:12`
  Test: `O31` in `supabase/tests/overnight_checks.sql`. Actual: `true`. Expected: `false`.
  `like '%@osu.edu'` only checks the ending, so an address with two `@` passes. Why unconfirmed:
  Supabase Auth checks the address format before the hook runs, and the login code is emailed to
  whatever the domain after the last `@` is, which is osu.edu here, so an outsider still can't
  receive it. Not exploitable as far as I can tell.
  Proposed fix (optional hardening): `email ~* '^[^@\s]+@osu\.edu$'` in `is_osu_email`, plus the same
  in `isOsuEmail` in `src/lib/authErrors.ts`. Keep O31 if you make the change; otherwise decide
  whether to change its expected value.

## Covered so far

- SQL (`supabase/tests/overnight_checks.sql`, registered in `run-sql-checks.mjs`), all passing except
  O31: shared-room gender separation (O1-O5); hidden vs made-up ids fail with the same error code
  (O6-O7); no-profile user can't post/join/see/count and can't pick a third gender (O8-O13);
  my_request_id / check_for_member_request describe only the caller (O14-O17); no kicking or
  removing other people's joins, one join at a time, joiner can't delete the request (O18-O21);
  post_request bad minutes / null room, 45 vs 46 min boundary (O22-O25); join/leave/cancel just
  before the 2-minute cutoff (O26-O28); no-profile user hears no realtime pings (O29-O30); OSU email
  edge cases (O31-O32); tally day is the Eastern date at 22:00 EST, on the DST-end night and the
  night before DST starts (O33-O34).
- SQL O35-O39: the error codes the app turns into messages are the ones the database really sends
  (post while joined / join while holding -> 23514; duplicates -> 23505), so users see the right text.
- Time (`src/lib/__tests__/timeEdgeCases.test.ts`, 18 tests, all pass): DST days in order and on the
  right day, the 1:30am that happens twice, a whole-year sweep every 97 min (next prayer always in the
  future, never skips one, timetable on the right day), Postgres microsecond timestamps, expiry across
  midnight, formatCountdown odd inputs. Also passed with the phone set to Pacific/Kiritimati (+14),
  Pacific/Pago_Pago (-11), Australia/Lord_Howe (30-min DST), Asia/Kolkata (+5:30), Europe/Paris.
  (Only the existing "really is running in that zone" check trips on Kolkata, because Node reports the
  old alias Asia/Calcutta. Not an app bug; Kolkata isn't in the CI zone list.)
- Name rule fuzz: 4,000 random names through `validateName` and the database's `first_name_valid`:
  0 disagreements (one-off script, not kept in the repo).
- Rest of src/lib (`src/lib/__tests__/overnightEdgeCases.test.ts`, 34 tests, all pass): server errors
  with codes never shown as "No connection", raw Supabase text never shown, app email check never looser
  than the server, name trimming/NFC/no-break space/curly quote, membership with stale ids or someone
  else's Done, sortRooms with unknown rooms / no rooms / same building names.
- SQL drift guard (`src/lib/__tests__/sqlDrift.test.ts`, 10 tests, all pass): every function and policy
  the 2026-11-23 migration re-creates is identical to its copy in the schema files. Today they match;
  the test is there so a future edit to one copy fails CI instead of silently diverging (the live DB
  runs the migration's copy, but sqlConstants.test.ts only reads the schema files).
- `fetchWithTimeout` (`src/lib/__tests__/fetchWithTimeout.test.ts`, 5 tests, all pass): aborts at
  exactly 15 s, passes a caller's abort through, handles an already-aborted signal, clears its timer
  on success, keeps method/headers/body.
- Read-through of `src/hooks/useRequests.ts`: no new bugs beyond what docs/audit/findings.md already
  lists (stale-call guards, busy guard, zero-row deletes are all handled).
- Test mistakes fixed during the run: fetchWithTimeout's fake fetch ignored an already-aborted signal
  (a real fetch rejects at once); the test file first lacked a localStorage stub.
- Test mistake fixed during the run: O28 first deleted `where requester = ...`, which users can't do
  (no select on requester); changed to `where id = ...` like `useRequests.ts`.

## Clock runs (full `npm test` through the night)

The SQL checks use the real clock (`now()`), so a test can pass at one hour and fail at another.
Each wake-up runs the whole suite and logs the result here. Expected: only O31 fails.

- 00:41 ET: Jest 203/203 pass, time-zone reruns pass, SQL only O31 fails.
- 01:12 ET: same.
- 01:43 ET: same.
- 02:14 ET: same.
- 02:45 ET: same.
- 03:16 ET: same.
- 03:47 ET: same.
- 04:18 ET: same.
- 04:49 ET: same.
- 05:20 ET: same.
- 05:51 ET: same.
- 06:22 ET: same.
- 06:53 ET: same.
- 07:24 ET: same.
- 07:55 ET: same.
- 08:42 ET (final): same; typecheck and lint clean.

## Next up

1. Time logic: `src/lib/requestTime.ts`, `prayerTimes.ts`, `timeZones.ts` (expiry boundaries, DST, midnight).
2. The rest of `src/lib` (network, errors, name, membership, gate), plus fuzzing open-ended inputs.

## Suggested ai-log entries

None. There were no confirmed bugs in AI-written app code. The three mistakes caught were in the new
overnight tests themselves (O28's requester filter, the fake fetch, the missing localStorage stub),
and the tests caught them before anything was logged. If you want one as a story: "2026-11-25: an
AI-written SQL test filtered on a column users can't read; the permission error showed the test was
wrong, not the app."

# Audit checklist

Each audit run takes the first unchecked area, audits it, appends findings to
`findings.md`, and ticks the box. Areas are sized to fit one fresh session.

- [x] 2. Auth flow: src/app/login.tsx, src/app/_layout.tsx (auth gating/redirects), src/lib/supabase.ts, src/lib/authErrors.ts
- [x] 3. Profile, setup, delete account: src/app/profile.tsx, src/app/setup.tsx, supabase/delete_account.sql, supabase/tests/delete_account_checks.sql
- [x] 4. Security SQL (profiles): supabase/profile.sql, supabase/verify_osu_email.sql — RLS, grants, security definer search_path, gender separation, anon access
- [x] 5. Security SQL (requests): supabase/requests.sql, supabase/joins.sql — RLS, grants, gender separation, who can read identifying columns
- [x] 6. Security SQL (the rest): supabase/expiry.sql, supabase/tally.sql, supabase/live_updates.sql, supabase/rooms.sql and their tests — ADR 0001 anonymity, expiry correctness
- [x] 7. Requests client: src/context/RequestsContext.tsx, src/hooks/useRequests.ts, src/data/request.ts, src/lib/requestTime.ts, src/app/(tabs)/requests.tsx — races, stale state, expiry, sign-out mid-action, realtime cleanup
- [x] 8. Prayer times and time zones: src/lib/prayerTimes.ts, src/components/PrayerCountdown.tsx, src/app/(tabs)/times.tsx — DST, midnight rollover, device time zone vs campus time zone
- [x] 9. Map and location: src/app/(tabs)/index.tsx, src/lib/directions.ts, src/lib/sortRooms.ts, src/components/MarkerPin.tsx, src/data/room.ts — ADR 0002 (location never sent/stored), permission denied paths
- [x] 10. Network and error handling: src/lib/network.ts, src/lib/errors.ts, src/components/LoadFailedScreen.tsx, src/components/StatusOverlay.tsx — offline, slow, timeouts, swallowed errors, unhandled promise rejections
- [x] 11. Remaining UI: src/components/SideMenu.tsx, FloatingTabBar.tsx, TitlePill.tsx, AppText.tsx, CampusIcon.tsx, src/fonts.ts, src/theme.ts, src/lib/fontFamily.ts, src/lib/wording.ts, src/app/(tabs)/_layout.tsx — effect cleanup, re-render loops, accessibility, dark mode
- [x] 12. Privacy policy vs reality: docs/privacy-policy.md against the ADRs, the SQL, and what the code actually collects/sends
- [x] 13. Config and repo hygiene: app.json, package.json, tsconfig.json, eslint.config.js, .github/workflows/ci.yml, .gitignore, .claude/settings.json — secrets in repo, App Store requirements (permission strings, account deletion), dependency issues
- [x] 14. Test coverage gaps: list testable logic with no tests, and security rules whose negative case is not tested
- [x] 1. Baseline: run `npm run typecheck`, `npm run lint`, `npm test`; report every error/warning and any flaky or trivially-passing test

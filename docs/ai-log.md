# AI log

Times Claude's code or review was wrong, and how it was caught.

- **2026-11-15:** Claude's review called the `joiners` RLS complete, with Leave covered by the delete policy, but missed that a delete can only reach rows the user can `select`, and `joiners` had no select policy.
  Caught by the phone test: Leave silently deleted 0 rows. Fixed with a select policy limited to the user's own row.
- **2026-11-18:** Claude's Done button (#6) deleted the request, so a finished congregation would never reach the tally from ADR 0001, and a joiner tapping Done lowered the headcount.
  Caught while building the #8 expiry job, before release. Fixed by making Done hide the request on the phone only and letting the server delete and count it.
- **2026-11-20:** Claude's TAP_WINS_MS guard (500ms) was tuned to Apple's default marker. After the switch to a custom marker view, the stray selection arrived at ~492ms and sometimes slipped past, opening the wrong room's panel.
  Caught by the phone test; timestamped logs in onPress/onSelect showed the gap. Fixed by widening the window to 1000ms.

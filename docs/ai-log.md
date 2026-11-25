# AI log

Times Claude's code or review was wrong, and how it was caught.

- **2026-11-15:** Claude's review called the `joiners` RLS complete, with Leave covered by the delete policy, but missed that a delete can only reach rows the user can `select`, and `joiners` had no select policy.
  Caught by the phone test: Leave silently deleted 0 rows. Fixed with a select policy limited to the user's own row.
- **2026-11-18:** Claude's Done button (#6) deleted the request, so a finished congregation would never reach the tally from ADR 0001, and a joiner tapping Done lowered the headcount.
  Caught while building the #8 expiry job, before release. Fixed by making Done hide the request on the phone only and letting the server delete and count it.
- **2026-11-20:** Claude's TAP_WINS_MS guard (500ms) was tuned to Apple's default marker. After the switch to a custom marker view, the stray selection arrived at ~492ms and sometimes slipped past, opening the wrong room's panel.
  Caught by the phone test; timestamped logs in onPress/onSelect showed the gap. Fixed by widening the window to 1000ms.
- **2026-11-21:** Claude's recenter button relied on `onRegionChange`'s `isGesture` to stop following the user, but `isGesture` is Google Maps only. On Apple Maps following never turned off: every drag snapped back to the user and the button did nothing.
  Caught by the phone test; confirmed in the react-native-maps docs. Fixed by following only until the recenter move finishes.
- **2026-11-22:** Claude's fix for the zoomed-out marker highlight jumping to a neighbour (delay untapped selections 200ms so a tap can cancel them) was built on an unconfirmed theory of the event order, without timing logs first.
  Caught by the phone test: the highlight still jumps sometimes. Not fixed yet; next step is logging the real onPress/onSelect order.
- **2026-11-23:** Claude's first "phone in another time zone" prayer tests set `process.env.TZ` inside the test file, which does nothing in Jest (each file gets its own copy of `process.env`), so they passed with or without the fix.
  Caught by a mutation check (putting the old code back and seeing the tests still pass). Fixed by rerunning the tests in a separate process per zone, each asserting the zone it runs in.
- **2026-11-23:** Claude's auto-retry change passed the banner's tap event into `retryLoads(auto)`, which would have silenced the "Still offline" message for every tap.
  Caught by Claude's own review before commit. Fixed with `onPress={() => retryLoads()}`.
- **2026-11-24:** The timing logs showed the 2026-11-22 theory was wrong: the tap came first, and the "jump" was a stray Apple selection of a neighbour ~500ms later, which react-native-maps lifts to zIndex +999, above the open room's zIndex 1. They also showed Claude's "already open" check read `selectedRoom`, still stale 2ms after the tap, so the panel reopened and reset.
  Caught by dev-only event logs on the phone plus reading react-native-maps' AIRMapMarker.m. Fixed by giving the open room a zIndex above that boost (10,000), a fixed resting zIndex per marker, and comparing against the tapped room id.
- **2026-11-24:** Claude's Report a problem email template used bare `\n` line breaks in the mailto body, so the mail app showed the whole template on one line. The mailto standard (RFC 6068) requires CRLF (`%0D%0A`).
  Caught by the user's phone test. Fixed by using `\r\n` and a test that fails on any bare `%0A`.
- **2026-11-24:** Claude's first unchecked-Supabase-error lint rule used `:has(> ObjectPattern > Property[key.name='error'])`, which this esquery version silently never matches, so it flagged every database call, even ones that did check `error`.
  Caught by the rule's own tests (the "allows destructuring error" case failed). Fixed by making the braces the subject, so only a one-step `:has(> Property)` is needed.

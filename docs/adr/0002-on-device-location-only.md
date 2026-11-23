# Show the user's location on the map, but never send or store it

The map shows a blue dot for the user and a button that recentres the map on them. To move the map, the app keeps the latest position the map reports in a `useRef`, in memory only. It is never put in state or context, never logged, never sent to Supabase or anywhere else, and never saved on the phone; it's gone when the app closes. This keeps the rule that no location history is stored, and prayer locations stay fixed (no GPS-based matching).

We first tried keeping coordinates out of app code entirely by switching on the map's own "follow user" mode for a moment. It was slow and broke if pressed while the map was still moving, so we accepted reading the position in memory.

## Consequences

- The app asks for "while using the app" location permission only; background location is off. If denied, there's no dot and no recenter button; everything else works.
- The permission, not this ref, is the real boundary: any code in the app could read location once it's granted. What we control is never sending or keeping it, so reviews should flag any log, state, context, network call or analytics that touches the position.
- Features like "nearest room" or distance on a request would use the position for more than moving the map. That needs a new decision, not a quiet extension of this one.
- The privacy policy must say location is used on the device only.

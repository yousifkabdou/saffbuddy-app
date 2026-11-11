// One row of the requests table, as the app reads it. requester is left out:
// the column grant hides it, so selecting it would fail.
export type PrayerRequest = {
    id : string;
    room_id : string;
    start_time : string; // ISO timestamp from Postgres, e.g. "2026-11-05T19:15:00+00:00"
}

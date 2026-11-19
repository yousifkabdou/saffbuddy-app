// Time rules for requests. "In progress" and "expired" aren't stored anywhere;
// they're worked out from the start time and the current clock.

// Joining stays open until this many minutes after the start time.
// Must match the interval in the joiners insert policy (supabase/joins.sql).
export const JOIN_GRACE_MINUTES = 2;

// A request disappears this many minutes after its start time.
export const EXPIRY_MINUTES = 15;

// The server deletes a request (and counts it in the tally) this many minutes
// after its start time. Must match the interval in supabase/expiry.sql.
export const SERVER_DELETE_MINUTES = 17;

const MINUTE = 60 * 1000;

// When the user is free to post or join again: the server deletes at
// SERVER_DELETE_MINUTES, and the job runs once a minute, so allow 1 more.
export function freeAgainAt(startTime: string) {
  return new Date(new Date(startTime).getTime() + (SERVER_DELETE_MINUTES + 1) * MINUTE).toISOString();
}

// Past the join cutoff: show "In progress", no Join button.
export function isInProgress(startTime: string, now: number) {
  return now >= new Date(startTime).getTime() + JOIN_GRACE_MINUTES * MINUTE;
}

// Past expiry: hide it, even if the server hasn't deleted it yet.
export function isExpired(startTime: string, now: number) {
  return now >= new Date(startTime).getTime() + EXPIRY_MINUTES * MINUTE;
}

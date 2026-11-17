// Time rules for requests. "In progress" and "expired" aren't stored anywhere;
// they're worked out from the start time and the current clock.

// Joining stays open until this many minutes after the start time.
// Must match the interval in the joiners insert policy (supabase/joins.sql).
export const JOIN_GRACE_MINUTES = 2;

// A request disappears this many minutes after its start time.
export const EXPIRY_MINUTES = 15;

const MINUTE = 60 * 1000;

// Past the join cutoff: show "In progress", no Join button.
export function isInProgress(startTime: string, now: number) {
  return now >= new Date(startTime).getTime() + JOIN_GRACE_MINUTES * MINUTE;
}

// Past expiry: hide it, even if the server hasn't deleted it yet.
export function isExpired(startTime: string, now: number) {
  return now >= new Date(startTime).getTime() + EXPIRY_MINUTES * MINUTE;
}

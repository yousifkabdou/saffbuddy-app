// Turns a failed Supabase call into a message the user can act on.
// The database (RLS + constraints) is what refuses actions, so the error code is all the app
// gets: it can't tell exactly which rule failed, only roughly why. Each action names its likely causes.

export type RequestAction = "post" | "join" | "leave" | "cancel";

// The parts of a Supabase/Postgres error we look at. `code` is Postgres's SQLSTATE
// (e.g. "23505"); network failures have no code, only a message.
export type AppError = { code?: string; message: string };

// Postgres error codes we expect from the requests/joiners rules.
export const UNIQUE_VIOLATION = "23505";     // a unique/primary key already exists (one request / one join per user)
const FOREIGN_KEY_VIOLATION = "23503"; // the row it points at is gone (request cancelled or expired)
const RLS_REFUSED = "42501";           // a row-level security policy said no
// The one-role triggers (supabase/joins.sql) raise this when the user is already in the other
// table: a request while joined, or a join while holding a request.
export const CHECK_VIOLATION = "23514";

// Not from Postgres: the app sets this when a delete succeeds but removes zero rows.
// Supabase doesn't treat that as an error, so without it a refused or stale Leave/Cancel looks like it worked.
export const NOTHING_DELETED = "NOTHING_DELETED";
export const NOTHING_DELETED_ERROR: AppError = { code: NOTHING_DELETED, message: "delete matched zero rows" };

// Not from Postgres either: the app sets this when the user tries to Cancel or Leave a request
// that has already started (a confirm left open past the start). The database refuses it too.
export const ALREADY_STARTED = "ALREADY_STARTED";
export const ALREADY_STARTED_ERROR: AppError = { code: ALREADY_STARTED, message: "request already started" };
const ALREADY_STARTED_MESSAGE = "It's already started. Tap Done when you've prayed.";

// No code + a fetch/network message = the request never reached the database.
// "abort" covers our own timeout (fetchWithTimeout in src/lib/supabase.ts), which comes back
// as { code: "", message: "AbortError: Aborted" }.
export function isNetworkError(error: AppError) {
  return !error.code && /network|fetch|timed? ?out|offline|abort/i.test(error.message);
}

export const NO_CONNECTION = "No connection. Check your internet and try again.";

export function actionErrorMessage(action: RequestAction, error: AppError): string {
  if (isNetworkError(error)) return NO_CONNECTION;

  switch (action) {
    case "post":
      if (error.code === UNIQUE_VIOLATION) return "You already have a request. Cancel it to post a new one.";
      if (error.code === RLS_REFUSED) return "Couldn't post your request. You may already be in another request.";
      if (error.code === CHECK_VIOLATION) return "You're already in another request. Leave it to post one.";
      return "Couldn't post your request. Try again.";
    case "join":
      if (error.code === UNIQUE_VIOLATION) return "You're already in a request. Leave it to join this one.";
      if (error.code === FOREIGN_KEY_VIOLATION || error.code === RLS_REFUSED)
        return "Couldn't join. It may have already started or been cancelled.";
      if (error.code === CHECK_VIOLATION) return "You already have a request. Cancel it to join this one.";
      return "Couldn't join. Try again.";
    case "leave":
      if (error.code === ALREADY_STARTED) return ALREADY_STARTED_MESSAGE;
      // Zero rows: already gone, or (since the database refuses late Leaves) it just started.
      if (error.code === NOTHING_DELETED) return "Couldn't leave. It may have already started or ended.";
      return "Couldn't leave the request. Try again.";
    case "cancel":
      if (error.code === ALREADY_STARTED) return ALREADY_STARTED_MESSAGE;
      if (error.code === NOTHING_DELETED) return "Couldn't cancel. Your request may have already started or ended.";
      return "Couldn't cancel your request. Try again.";
  }
}

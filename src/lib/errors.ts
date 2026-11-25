// Turns a failed Supabase call into a message the user can act on.
// The database (RLS + constraints) is what refuses actions, so the error code is all the app
// gets: it can't tell exactly which rule failed, only roughly why. Each action names its likely causes.

export type RequestAction = "post" | "join" | "leave" | "cancel";

// The parts of a Supabase/Postgres error we look at. `code` is Postgres's SQLSTATE
// (e.g. "23505"); network failures have no code, only a message.
export type AppError = { code?: string; message: string };

// Postgres error codes we expect from the requests/joiners rules.
const UNIQUE_VIOLATION = "23505";      // a unique/primary key already exists (one request / one join per user)
const FOREIGN_KEY_VIOLATION = "23503"; // the row it points at is gone (request cancelled or expired)
const RLS_REFUSED = "42501";           // a row-level security policy said no

// Not from Postgres: the app sets this when a delete succeeds but removes zero rows.
// Supabase doesn't treat that as an error, so without it a refused or stale Leave/Cancel looks like it worked.
export const NOTHING_DELETED = "NOTHING_DELETED";
export const NOTHING_DELETED_ERROR: AppError = { code: NOTHING_DELETED, message: "delete matched zero rows" };

// No code + a fetch/network message = the request never reached the database.
// "abort" covers our own timeout (fetchWithTimeout in src/lib/supabase.ts), which comes back
// as { code: "", message: "AbortError: Aborted" }.
export function isNetworkError(error: AppError) {
  return !error.code && /network|fetch|timed? ?out|offline|abort/i.test(error.message);
}

const NO_CONNECTION = "No connection. Check your internet and try again.";

export function actionErrorMessage(action: RequestAction, error: AppError): string {
  if (isNetworkError(error)) return NO_CONNECTION;

  switch (action) {
    case "post":
      if (error.code === UNIQUE_VIOLATION) return "You already have a request. Cancel it to post a new one.";
      if (error.code === RLS_REFUSED) return "Couldn't post your request. You may already be in another request.";
      return "Couldn't post your request. Try again.";
    case "join":
      if (error.code === UNIQUE_VIOLATION) return "You're already in a request. Leave it to join this one.";
      if (error.code === FOREIGN_KEY_VIOLATION || error.code === RLS_REFUSED)
        return "Couldn't join. It may have already started or been cancelled.";
      return "Couldn't join. Try again.";
    case "leave":
      if (error.code === NOTHING_DELETED) return "Couldn't leave. The request may have already ended.";
      return "Couldn't leave the request. Try again.";
    case "cancel":
      if (error.code === NOTHING_DELETED) return "Couldn't cancel. Your request may have already ended.";
      return "Couldn't cancel your request. Try again.";
  }
}

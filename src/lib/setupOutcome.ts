import { isNetworkError, type AppError } from "@/lib/errors";

// Where the setup screen goes after trying to save the profile, or what it says if it can't.
// A pure function so each case can be tested without rendering the screen.
//   welcome: the profile was just created, so this is a new user (the only way to reach Welcome)
//   home:    a profile already existed, so they aren't new
export type SetupOutcome = { go: "welcome" } | { go: "home" } | { error: string };

export const NO_CONNECTION = "No connection. Check your internet and try again.";

const UNIQUE_VIOLATION = "23505"; // the profile row already exists
const CHECK_VIOLATION = "23514";  // a check constraint (name rule, gender values) refused it

export function setupOutcome(insertError: AppError | null): SetupOutcome {
  if (!insertError) return { go: "welcome" };
  if (insertError.code === UNIQUE_VIOLATION) return { go: "home" };
  if (insertError.code === CHECK_VIOLATION) return { error: "Please check your name and try again" };
  if (isNetworkError(insertError)) return { error: NO_CONNECTION };
  return { error: "Something went wrong. Try again." };
}

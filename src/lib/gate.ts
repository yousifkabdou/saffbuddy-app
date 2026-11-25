// Which screen the tabs layout shows, from what it knows about the session and profile.
// A pure function so every branch can be tested without rendering anything.

export type Gate = "wait" | "login" | "retry" | "setup" | "tabs";

export type GateState = {
  loading: boolean;       // the first check hasn't finished
  hasSession: boolean;    // a signed-in session is known
  sessionFailed: boolean; // the session check failed for a network reason (it may still be valid)
  profileFailed: boolean; // the profile check failed (network or server)
  hasProfile: boolean;    // the profile check succeeded and found a row
};

export function gateFor(s: GateState): Gate {
  if (s.loading) return "wait";
  // Checked before "no session": offline with an expired access token, the session can't be
  // confirmed but is still saved on the phone. Sending them to login would make them redo the
  // email code for nothing, and login can't work offline anyway.
  if (s.sessionFailed) return "retry";
  if (!s.hasSession) return "login";
  // "Couldn't check" is not "has no profile": treating it that way sent existing users to setup.
  if (s.profileFailed) return "retry";
  if (!s.hasProfile) return "setup";
  return "tabs";
}

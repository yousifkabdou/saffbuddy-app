import { describe, expect, it } from "@jest/globals";
import { gateFor, GateState } from "@/lib/gate";

const signedInWithProfile: GateState = {
  loading: false, hasSession: true, sessionFailed: false, profileFailed: false, hasProfile: true,
};

describe("gateFor", () => {
  it("waits while the first check runs", () => {
    expect(gateFor({ ...signedInWithProfile, loading: true })).toBe("wait");
  });

  it("shows the tabs for a signed-in user with a profile", () => {
    expect(gateFor(signedInWithProfile)).toBe("tabs");
  });

  it("sends a signed-out user to login", () => {
    expect(gateFor({ ...signedInWithProfile, hasSession: false, hasProfile: false })).toBe("login");
  });

  it("offers retry, not login, when the session check failed on the network", () => {
    // The offline-with-expired-token case: no session object, but it's still saved on the phone.
    expect(gateFor({ ...signedInWithProfile, hasSession: false, sessionFailed: true })).toBe("retry");
  });

  it("offers retry, not setup, when the profile check failed", () => {
    expect(gateFor({ ...signedInWithProfile, profileFailed: true, hasProfile: false })).toBe("retry");
  });

  it("sends a signed-in user with no profile to setup", () => {
    expect(gateFor({ ...signedInWithProfile, hasProfile: false })).toBe("setup");
  });
});

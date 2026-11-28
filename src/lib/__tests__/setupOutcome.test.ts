import { describe, expect, it } from "@jest/globals";
import { setupOutcome } from "@/lib/setupOutcome";

describe("setupOutcome", () => {
  it("sends a newly created profile to the welcome screen", () => {
    expect(setupOutcome(null)).toEqual({ go: "welcome" });
  });

  // 23505 = the profile row already exists (e.g. saved on another phone, or a retried save
  // that had actually gone through). They aren't new, so no welcome.
  it("sends someone whose profile already exists straight home", () => {
    expect(setupOutcome({ code: "23505", message: "duplicate key value" })).toEqual({ go: "home" });
  });

  // 23514 = a check constraint refused it (the database's name rule, or the gender values).
  it("stays on setup with a name message when the database refuses the values", () => {
    expect(setupOutcome({ code: "23514", message: "violates check constraint" }))
      .toEqual({ error: "Please check your name and try again" });
  });

  it("asks the user to check their connection when the save never reached the server", () => {
    expect(setupOutcome({ message: "TypeError: Network request failed" }))
      .toEqual({ error: "No connection. Check your internet and try again." });
  });

  // e.g. 42501 (row-level security refused it): no raw codes, they mean nothing to the user.
  it("shows a plain retry message for any other failure", () => {
    expect(setupOutcome({ code: "42501", message: "new row violates row-level security policy" }))
      .toEqual({ error: "Something went wrong. Try again." });
  });
});

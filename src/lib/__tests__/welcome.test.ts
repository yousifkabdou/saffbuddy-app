import { describe, expect, it } from "@jest/globals";
import { WELCOME_STEPS } from "@/lib/welcome";

describe("WELCOME_STEPS", () => {
  // The app offers requests starting 5, 10, 15, 30 or 45 minutes ahead (START_OFFSETS), and the
  // database enforces the same window. If the offsets change, this copy must change with them.
  it("tells new users requests start 5–45 minutes ahead", () => {
    const request = WELCOME_STEPS.find((s) => s.title === "Start or join a request");
    expect(request?.body).toContain("starting in 5–45 minutes");
  });
});

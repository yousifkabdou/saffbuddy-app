import { describe, expect, it } from "@jest/globals";
import { PrayerRequest } from "@/data/request";
import { membership } from "@/lib/membership";

const MINUTE = 60 * 1000;
const now = Date.UTC(2026, 10, 23, 18, 0); // fixed instant, so the tests don't depend on the real clock
const startingIn = (minutes: number) => new Date(now + minutes * MINUTE).toISOString();

const mine: PrayerRequest = { id: "mine", room_id: "r1", start_time: startingIn(10) };
const theirs: PrayerRequest = { id: "theirs", room_id: "r2", start_time: startingIn(10) };
const none = { myRequestId: null, myJoinedId: null, doneId: null, now };

describe("membership", () => {
  it("own request before it starts is active", () => {
    const m = membership({ ...none, requests: [mine, theirs], myRequestId: "mine" });
    expect(m.activeRequestRow).toBe(mine);
    expect(m.finishingRow).toBeUndefined();
  });

  it("own request after Done is finishing, not active (no Cancel on a prayer that happened)", () => {
    const m = membership({ ...none, requests: [mine], myRequestId: "mine", doneId: "mine" });
    expect(m.activeRequestRow).toBeUndefined();
    expect(m.finishingRow).toBe(mine);
  });

  it("joined request past expiry (8 min) is finishing", () => {
    const old = { ...theirs, start_time: startingIn(-8) };
    const m = membership({ ...none, requests: [old], myJoinedId: "theirs" });
    expect(m.activeJoinedRow).toBeUndefined();
    expect(m.finishingRow).toBe(old);
  });

  it("joined request just before expiry is still active", () => {
    const recent = { ...theirs, start_time: new Date(now - 8 * MINUTE + 1).toISOString() };
    expect(membership({ ...none, requests: [recent], myJoinedId: "theirs" }).activeJoinedRow).toBe(recent);
  });

  it("an id pointing at a row that's no longer in the list gives nothing", () => {
    const m = membership({ ...none, requests: [theirs], myRequestId: "gone", myJoinedId: "gone too" });
    expect(m).toEqual({
      myRequestRow: undefined, myJoinedRow: undefined,
      activeRequestRow: undefined, activeJoinedRow: undefined, finishingRow: undefined,
    });
  });

  it("holding both a request and a join: both show as active (the database now prevents this)", () => {
    const m = membership({ ...none, requests: [mine, theirs], myRequestId: "mine", myJoinedId: "theirs" });
    expect(m.activeRequestRow).toBe(mine);
    expect(m.activeJoinedRow).toBe(theirs);
  });

  it("with nothing loaded, the user is in nothing", () => {
    expect(membership({ ...none, requests: [] }).finishingRow).toBeUndefined();
  });
});

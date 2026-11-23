import { describe, expect, it } from "@jest/globals";
import { freeAgainAt, isExpired, isInProgress } from "@/lib/requestTime";

const START = "2026-11-19T18:00:00.000Z";
const start = new Date(START).getTime();
const MINUTE = 60 * 1000;

describe("isInProgress", () => {
  it("is false before the 2-minute join cutoff", () => {
    expect(isInProgress(START, start + 2 * MINUTE - 1)).toBe(false);
  });
  it("is true from the cutoff on", () => {
    expect(isInProgress(START, start + 2 * MINUTE)).toBe(true);
  });
});

describe("isExpired", () => {
  it("is false just before 8 minutes after start", () => {
    expect(isExpired(START, start + 8 * MINUTE - 1)).toBe(false);
  });
  it("is true at 8 minutes after start", () => {
    expect(isExpired(START, start + 8 * MINUTE)).toBe(true);
  });
});

describe("freeAgainAt", () => {
  it("is 11 minutes after start (server deletes at 10, cron runs each minute)", () => {
    expect(freeAgainAt(START)).toBe("2026-11-19T18:11:00.000Z");
  });
});

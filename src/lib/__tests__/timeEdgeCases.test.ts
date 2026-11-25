/// <reference types="node" />
import { describe, expect, it } from "@jest/globals";
import { campusDay, formatCampusDate } from "@/lib/campusTime";
import { dailyTimes, formatCountdown, nextPrayer } from "@/lib/prayerTimes";
import { EXPIRY_MINUTES, JOIN_GRACE_MINUTES, SERVER_DELETE_MINUTES, freeAgainAt, isExpired, isInProgress } from "@/lib/requestTime";

// Overnight edge cases (2026-11-25): DST days, whole-year sweeps, odd inputs.
// Also run with the phone in other zones by scripts/jest/other-time-zones.js.
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const campusDateOf = (d: Date) => formatCampusDate(d);

describe("DST days in Columbus", () => {
  // 2026-03-08: clocks go forward at 2am. 2026-11-01: clocks go back at 2am.
  for (const iso of ["2026-03-08T16:00:00Z", "2026-11-01T16:00:00Z"]) {
    it(`timetable for ${iso} is in order and all on that campus day`, () => {
      const times = dailyTimes(new Date(iso));
      const day = campusDateOf(new Date(iso));
      for (let i = 1; i < times.length; i++) {
        expect(times[i].time.getTime()).toBeGreaterThan(times[i - 1].time.getTime());
      }
      for (const t of times) expect(campusDateOf(t.time)).toBe(day);
    });
  }

  it("1:30am on the night clocks go back (happens twice) still gives that day's Fajr next", () => {
    for (const iso of ["2026-11-01T05:30:00Z", "2026-11-01T06:30:00Z"]) { // 1:30 EDT, then 1:30 EST
      const p = nextPrayer(new Date(iso));
      expect(p.name).toBe("Fajr");
      expect(campusDateOf(p.time)).toBe("Sunday, November 1");
    }
  });

  it("campusDay on the DST days gives the right calendar day", () => {
    const d = campusDay(new Date("2026-03-08T07:30:00Z")); // 3:30 EDT Mar 8 (2:xx didn't exist)
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 2, 8]);
  });
});

describe("whole-year sweep (every 97 minutes through 2026)", () => {
  // 97 minutes so the samples drift across every time of day instead of repeating.
  const samples: Date[] = [];
  for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2027, 0, 1); t += 97 * MINUTE) samples.push(new Date(t));

  it("the next prayer is always in the future, and less than 13 hours away", () => {
    for (const now of samples) {
      const gap = nextPrayer(now).time.getTime() - now.getTime();
      if (!(gap > 0 && gap < 13 * HOUR)) throw new Error(`bad gap ${gap} at ${now.toISOString()}`);
    }
  });

  it("no prayer starts between now and the one nextPrayer picks", () => {
    for (const now of samples) {
      const next = nextPrayer(now).time.getTime();
      const all = [-1, 0, 1].flatMap((o) => dailyTimes(new Date(now.getTime() + o * 24 * HOUR)))
        .filter((p) => p.name !== "Shurooq");
      const skipped = all.find((p) => p.time.getTime() > now.getTime() && p.time.getTime() < next);
      if (skipped) throw new Error(`skipped ${skipped.name} at ${now.toISOString()}`);
    }
  });

  it("each day's timetable is in order and on the campus day of the moment asked for", () => {
    for (const now of samples) {
      const times = dailyTimes(now);
      const day = campusDateOf(now);
      for (let i = 0; i < times.length; i++) {
        if (campusDateOf(times[i].time) !== day) throw new Error(`${times[i].name} off-day at ${now.toISOString()}`);
        if (i > 0 && times[i].time <= times[i - 1].time) throw new Error(`out of order at ${now.toISOString()}`);
      }
    }
  });
});

describe("request time boundaries keep their order", () => {
  // The app relies on: join cutoff < hidden < server delete < free again.
  it("constants are ordered so nothing disappears before it closes", () => {
    expect(JOIN_GRACE_MINUTES).toBeLessThan(EXPIRY_MINUTES);
    expect(EXPIRY_MINUTES).toBeLessThan(SERVER_DELETE_MINUTES);
  });

  it("works with the server's microsecond timestamps (Postgres sends 6 fraction digits)", () => {
    const start = "2026-11-25T18:00:00.123456+00:00";
    const ms = Date.parse("2026-11-25T18:00:00.123Z");
    expect(isInProgress(start, ms + JOIN_GRACE_MINUTES * MINUTE)).toBe(true);
    expect(isExpired(start, ms + EXPIRY_MINUTES * MINUTE - 1)).toBe(false);
    expect(freeAgainAt(start)).toBe("2026-11-25T18:11:00.123Z");
  });

  it("a request across midnight (start 23:58 ET) expires at the right instant", () => {
    const start = "2026-11-25T04:58:00Z"; // 23:58 Nov 24 in Columbus
    expect(isExpired(start, Date.parse("2026-11-25T05:06:00Z") - 1)).toBe(false);
    expect(isExpired(start, Date.parse("2026-11-25T05:06:00Z"))).toBe(true);
  });
});

describe("formatCountdown odd inputs", () => {
  it.each([
    [0, "0:00"], [-5000, "0:00"], [1, "0:01"], [59_999, "1:00"], [3_600_000, "1:00:00"],
    [3_599_001, "1:00:00"], [36_000_000, "10:00:00"], [86_400_000, "24:00:00"],
  ])("%p ms -> %p", (ms, out) => {
    expect(formatCountdown(ms)).toBe(out);
  });
});

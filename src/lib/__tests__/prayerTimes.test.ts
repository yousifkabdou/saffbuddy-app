import { describe, expect, it } from "@jest/globals";
import { formatCampusTime } from "@/lib/campusTime";
import { dailyTimes, formatCountdown, nextPrayer } from "@/lib/prayerTimes";

const ORDER = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

describe("nextPrayer", () => {
  it("is always in the future", () => {
    const now = new Date(2026, 10, 20, 13, 0);
    expect(nextPrayer(now).time.getTime()).toBeGreaterThan(now.getTime());
  });

  it("walks through the day in order, then rolls over to tomorrow's Fajr", () => {
    let now = new Date(2026, 10, 20, 0, 1); // just after midnight: next is today's Fajr
    const seen: string[] = [];
    for (let i = 0; i < 6; i++) {
      const p = nextPrayer(now);
      seen.push(p.name);
      now = p.time; // stand exactly at that prayer's start time
    }
    expect(seen).toEqual([...ORDER, "Fajr"]);
    expect(now.getDate()).toBe(21); // the last Fajr is the next day
  });

  it("at a prayer's exact start time, moves on to the next prayer", () => {
    const fajr = nextPrayer(new Date(2026, 10, 20, 0, 1));
    expect(nextPrayer(fajr.time).name).toBe("Dhuhr");
  });

  it("rolls over the end of a month and a year", () => {
    const lateNye = new Date(2026, 11, 31, 23, 59);
    const p = nextPrayer(lateNye);
    expect(p.name).toBe("Fajr");
    expect(p.time.getFullYear()).toBe(2027);
    expect(p.time.getMonth()).toBe(0);
    expect(p.time.getDate()).toBe(1);
  });
});

describe("formatCountdown", () => {
  it("shows hours when there are any", () => {
    expect(formatCountdown((1 * 3600 + 23 * 60 + 45) * 1000)).toBe("1:23:45");
    expect(formatCountdown((2 * 3600 + 5) * 1000)).toBe("2:00:05");
  });
  it("drops hours under an hour", () => {
    expect(formatCountdown((25 * 60 + 3) * 1000)).toBe("25:03");
    expect(formatCountdown(9 * 1000)).toBe("0:09");
  });
  it("rounds up partial seconds and never goes negative", () => {
    expect(formatCountdown(500)).toBe("0:01");
    expect(formatCountdown(-1000)).toBe("0:00");
  });
});

const campusTimes = (at: Date) => dailyTimes(at).map((t) => `${t.name} ${formatCampusTime(t.time)}`);

describe("known times (a regression lock: compare with a Columbus ISNA timetable once)", () => {
  // Values the library gave when this test was written. If a setting changes by mistake
  // (madhab, method, coordinates), these move and the test fails.
  it("Nov 20, 2026", () => {
    expect(campusTimes(new Date("2026-11-20T17:00:00Z"))).toEqual([
      "Fajr 6:04 AM", "Shurooq 7:23 AM", "Dhuhr 12:19 PM", "Asr 2:51 PM", "Maghrib 5:12 PM", "Isha 6:31 PM",
    ]);
  });
  it("Jun 30, 2026 (summer: Isha after 10 PM)", () => {
    expect(campusTimes(new Date("2026-06-30T16:00:00Z"))).toEqual([
      "Fajr 4:29 AM", "Shurooq 6:07 AM", "Dhuhr 1:37 PM", "Asr 5:34 PM", "Maghrib 9:05 PM", "Isha 10:42 PM",
    ]);
  });
});

describe("nextPrayer around the clock and the calendar", () => {
  it("a summer evening at 9:30 PM: next is that evening's Isha", () => {
    const p = nextPrayer(new Date("2026-07-01T01:30:00Z")); // Jun 30, 21:30 ET
    expect(p.name).toBe("Isha");
    expect(formatCampusTime(p.time)).toBe("10:42 PM");
  });

  it("every 30 minutes for a day: always in the future, and never more than a day away", () => {
    const start = new Date("2026-11-20T05:00:00Z").getTime(); // midnight ET
    for (let i = 0; i < 48; i++) {
      const now = new Date(start + i * 30 * 60 * 1000);
      const p = nextPrayer(now);
      expect(p.time.getTime()).toBeGreaterThan(now.getTime());
      expect(p.time.getTime() - now.getTime()).toBeLessThan(24 * 3600 * 1000);
    }
  });

  it.each([["Mar 8 (clocks go forward)", "2026-03-08T05:01:00Z"], ["Nov 1 (clocks go back)", "2026-11-01T04:01:00Z"]])(
    "%s: walks Fajr to Fajr in order", (_label, startIso) => {
      let now = new Date(startIso); // 00:01 ET
      const seen: string[] = [];
      for (let i = 0; i < 6; i++) {
        const p = nextPrayer(now);
        expect(p.time.getTime()).toBeGreaterThan(now.getTime());
        seen.push(p.name);
        now = p.time;
      }
      expect(seen).toEqual([...ORDER, "Fajr"]);
    });
});

describe("dailyTimes", () => {
  const day = new Date(2026, 10, 20, 12, 0);
  const times = dailyTimes(day);

  it("lists the five prayers plus Shurooq, in order", () => {
    expect(times.map((t) => t.name)).toEqual(["Fajr", "Shurooq", "Dhuhr", "Asr", "Maghrib", "Isha"]);
  });
  it("has times that go up through the day", () => {
    for (let i = 1; i < times.length; i++) {
      expect(times[i].time.getTime()).toBeGreaterThan(times[i - 1].time.getTime());
    }
  });
  it("agrees with nextPrayer (same prayer times, Shurooq aside)", () => {
    const fiveOnly = times.filter((t) => t.name !== "Shurooq");
    expect(nextPrayer(new Date(2026, 10, 20, 0, 1)).time.getTime()).toBe(fiveOnly[0].time.getTime());
  });
});

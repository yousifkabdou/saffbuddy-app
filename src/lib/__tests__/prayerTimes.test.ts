import { describe, expect, it } from "@jest/globals";
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

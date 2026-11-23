/// <reference types="node" />
import { describe, expect, it } from "@jest/globals";
import { campusDay, formatCampusDate, formatCampusTime } from "@/lib/campusTime";
import { dailyTimes, nextPrayer } from "@/lib/prayerTimes";
import { formatTime } from "@/lib/requestTime";

// Whatever time zone the phone is set to, the app shows campus prayers and campus times.
// Every expectation here is the same in every zone. npm test runs this file in Columbus time and
// again with the phone set to Paris, Los Angeles, Riyadh and UTC (scripts/jest/other-time-zones.js).
const phoneZone = process.env.TEST_PHONE_TZ ?? "America/New_York";

describe(`phone set to ${phoneZone}`, () => {
  it("really is running in that zone (so the tests below prove something)", () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(phoneZone);
  });

  it("18:10 on Nov 22 in Columbus (00:10 Nov 23 in Paris): next is Isha, not tomorrow's Fajr", () => {
    const now = new Date("2026-11-22T23:10:00Z");
    expect(nextPrayer(now).name).toBe("Isha");
    expect(formatCampusTime(nextPrayer(now).time)).toBe("6:30 PM");
  });

  it("the Times tab shows the campus day and its timetable", () => {
    const now = new Date("2026-11-22T23:10:00Z");
    expect(formatCampusDate(now)).toBe("Sunday, November 22");
    expect(formatCampusDate(dailyTimes(now)[0].time)).toBe("Sunday, November 22"); // Nov 22's Fajr
  });

  it("23:30 in Columbus (20:30 in Los Angeles): next is the next campus day's Fajr", () => {
    const p = nextPrayer(new Date("2026-11-23T04:30:00Z"));
    expect(p.name).toBe("Fajr");
    expect(formatCampusDate(p.time)).toBe("Monday, November 23");
  });

  it("a summer evening in Columbus: next is that evening's Isha", () => {
    expect(nextPrayer(new Date("2026-07-01T01:30:00Z")).name).toBe("Isha"); // Jun 30, 21:30 ET
  });

  it("request times are shown in campus time", () => {
    expect(formatTime("2026-11-23T18:40:00Z")).toBe("1:40 PM");
  });

  it("campusDay gives the Columbus calendar day", () => {
    const d = campusDay(new Date("2026-11-23T03:00:00Z")); // 22:00 Nov 22 in Columbus
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 10, 22]);
  });
});

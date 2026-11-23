// Campus time. The app only serves OSU, so dates and times are shown in Columbus time, whatever
// time zone the phone is set to (a visitor's phone, or one set to home time while studying here).
// Instants (Date objects, ISO strings) never change; only how they're read and shown does.

export const CAMPUS_TIME_ZONE = "America/New_York";

const dayParts = new Intl.DateTimeFormat("en-US", {
  timeZone: CAMPUS_TIME_ZONE, year: "numeric", month: "numeric", day: "numeric",
});

// The campus calendar day that `at` falls on, as a Date at local noon of that year/month/day.
// adhan reads the day from a Date's local year/month/date, so this hands it the campus day.
// Noon, not midnight: a daylight-saving change can't push noon onto another day.
// offsetDays moves to the day before (-1) or after (+1).
export function campusDay(at: Date, offsetDays = 0): Date {
  const parts = dayParts.formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return new Date(get("year"), get("month") - 1, get("day") + offsetDays, 12);
}

// "1:40 PM" in campus time.
export function formatCampusTime(at: Date): string {
  return at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: CAMPUS_TIME_ZONE });
}

// "Monday, November 23" in campus time.
export function formatCampusDate(at: Date): string {
  return at.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", timeZone: CAMPUS_TIME_ZONE });
}

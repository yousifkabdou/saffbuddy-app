import { CalculationMethod, Coordinates, Madhab, PrayerTimes } from "adhan";

// Prayer start times, calculated on the phone (no network) with the adhan library.
// Fixed to central campus, not the user's location: the app only serves OSU.
const CAMPUS = new Coordinates(40.000632, -83.013325);

// ISNA (North America) angles; standard (Shafi) Asr. To be checked against local mosque times.
const params = CalculationMethod.NorthAmerica();
params.madhab = Madhab.Shafi;

export type NextPrayer = { name: string; time: Date };

// The day's full timetable for the Prayer Times tab: the five prayers plus Shurooq (sunrise),
// which isn't a prayer but marks the end of Fajr's time.
export function dailyTimes(day: Date): NextPrayer[] {
  const t = new PrayerTimes(CAMPUS, day, params);
  return [
    { name: "Fajr", time: t.fajr },
    { name: "Shurooq", time: t.sunrise },
    { name: "Dhuhr", time: t.dhuhr },
    { name: "Asr", time: t.asr },
    { name: "Maghrib", time: t.maghrib },
    { name: "Isha", time: t.isha },
  ];
}

// The five daily prayers in order: the timetable without Shurooq, which isn't a prayer.
function prayersOn(day: Date): NextPrayer[] {
  return dailyTimes(day).filter((p) => p.name !== "Shurooq");
}

// The first prayer that starts after `now`. After Isha, that's tomorrow's Fajr.
// "After", not "at or after": at the exact start time the countdown moves on to the next prayer.
export function nextPrayer(now: Date): NextPrayer {
  const upcoming = prayersOn(now).find((p) => p.time.getTime() > now.getTime());
  if (upcoming) return upcoming;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1); // setDate handles month/year rollover
  return prayersOn(tomorrow)[0];
}

// Milliseconds left -> "1:23:45", or "23:45" under an hour. Rounds up so it never shows 0:00 early.
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

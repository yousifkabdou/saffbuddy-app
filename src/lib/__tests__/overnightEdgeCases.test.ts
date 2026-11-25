import { describe, expect, it } from "@jest/globals";
import { PrayerRequest } from "@/data/request";
import { Room } from "@/data/room";
import { isOsuEmail, secondsToWait, sendCodeErrorMessage, verifyCodeErrorMessage } from "@/lib/authErrors";
import { actionErrorMessage, isNetworkError } from "@/lib/errors";
import { membership } from "@/lib/membership";
import { normalizeName, validateName } from "@/lib/name";
import { sortRooms } from "@/lib/sortRooms";

// Overnight edge cases (2026-11-25) for the non-time parts of src/lib.
const MINUTE = 60 * 1000;
const now = Date.UTC(2026, 10, 25, 18, 0);
const at = (minutes: number) => new Date(now + minutes * MINUTE).toISOString();

describe("isNetworkError: real server errors are never mistaken for 'no connection'", () => {
  it.each([
    [{ code: "57014", message: "canceling statement due to statement timeout" }, false], // has a code: server answered
    [{ code: "PGRST301", message: "JWT expired" }, false],
    [{ code: "42501", message: "new row violates row-level security policy" }, false],
    [{ code: "", message: "TypeError: Network request failed" }, true], // supabase-js sets code "" on fetch failure
    [{ message: "Failed to fetch" }, true],
    [{ message: "Request timed out" }, true],
    [{ code: "", message: "AbortError: Aborted" }, true],
    [{ message: "" }, false],
  ])("%p -> %p", (error, expected) => {
    expect(isNetworkError(error)).toBe(expected);
  });

  it("a server timeout shows a retry message, not 'No connection'", () => {
    expect(actionErrorMessage("post", { code: "57014", message: "statement timeout" })).toBe("Couldn't post your request. Try again.");
  });
});

describe("auth messages for odd inputs", () => {
  it("secondsToWait reads singular and plural", () => {
    expect(secondsToWait("you can only request this after 1 second")).toBe(1);
    expect(secondsToWait("For security purposes, you can only request this after 42 seconds.")).toBe(42);
    expect(secondsToWait("Token has expired")).toBeNull();
  });
  it("an unknown auth error never shows Supabase's raw text", () => {
    const raw = "Database error saving new user";
    expect(sendCodeErrorMessage({ code: "unexpected_failure", message: raw })).not.toContain(raw);
    expect(verifyCodeErrorMessage({ code: "unexpected_failure", message: raw })).not.toContain(raw);
  });
});

describe("isOsuEmail (app) never accepts what the server refuses", () => {
  // Server rule (is_osu_email): email ~* '^[^@\s]+@osu\.edu$'. The app may be stricter, never looser.
  const serverAccepts = (e: string) => /^[^@\s]+@osu\.edu$/i.test(e);
  it.each([
    "a.1@osu.edu", "A.1@OSU.EDU", "x@notosu.edu", "x@osu.edu.evil.com", "x@buckeyemail.osu.edu",
    "x@evil.com@osu.edu", " x@osu.edu", "x@osu.edu ", "@osu.edu", "x @osu.edu", "x@osu.eduu", "x@osu,edu",
  ])("%p", (email) => {
    if (isOsuEmail(email)) expect(serverAccepts(email)).toBe(true);
  });
});

describe("names: what the user types vs what is saved", () => {
  it.each([
    ["  Ali  ", ""],            // trimmed before checking
    ["José", ""],         // decomposed accent becomes one character after NFC
    ["Ali Amin", "Name can only contain letters, spaces, hyphens and apostrophes"], // no-break space inside
    ["O‘Neil", "Name can only contain letters, spaces, hyphens and apostrophes"], // left curly quote isn't allowed
    ["😀😀", "Name can only contain letters, spaces, hyphens and apostrophes"],
  ])("%p -> %p", (raw, message) => {
    expect(validateName(normalizeName(raw))).toBe(message);
  });
});

describe("membership with odd state", () => {
  const mine: PrayerRequest = { id: "mine", room_id: "r1", start_time: at(10) };
  const theirs: PrayerRequest = { id: "theirs", room_id: "r2", start_time: at(10) };

  it("Done on someone else's request (not mine, not joined) changes nothing for me", () => {
    const m = membership({ requests: [mine, theirs], myRequestId: "mine", myJoinedId: null, doneId: "theirs", now });
    expect(m.activeRequestRow).toBe(mine);
    expect(m.finishingRow).toBeUndefined();
  });

  it("an empty list with stale ids: nothing active, nothing finishing", () => {
    const m = membership({ requests: [], myRequestId: "mine", myJoinedId: "theirs", doneId: "mine", now });
    expect(m).toEqual({ myRequestRow: undefined, myJoinedRow: undefined, activeRequestRow: undefined, activeJoinedRow: undefined, finishingRow: undefined });
  });

  it("works with Postgres-style timestamps (+00:00 and microseconds)", () => {
    const pg = { ...mine, start_time: "2026-11-25T17:52:00.123456+00:00" }; // started 7m59.9s ago
    expect(membership({ requests: [pg], myRequestId: "mine", myJoinedId: null, doneId: null, now }).activeRequestRow).toBe(pg);
  });
});

describe("sortRooms odd input", () => {
  const room = (id: string, building: string): Room =>
    ({ id, building, is_open: true, floor: "1", room_num: "1", latitude: 0, longitude: 0, gender: null });

  it("a request for a room not in the list is dropped, not crashed on", () => {
    const groups = sortRooms([room("a", "A")], [{ id: "x", room_id: "gone", start_time: at(5) }], now);
    expect(groups).toHaveLength(1);
    expect(groups[0].requests).toHaveLength(0);
  });

  it("no rooms at all gives an empty list", () => {
    expect(sortRooms([], [{ id: "x", room_id: "a", start_time: at(5) }], now)).toEqual([]);
  });

  it("is a stable order for rooms with the same building name", () => {
    const rooms = [room("a", "Same"), room("b", "Same"), room("c", "Same")];
    expect(sortRooms(rooms, [], now).map((g) => g.room.id)).toEqual(["a", "b", "c"]);
  });
});

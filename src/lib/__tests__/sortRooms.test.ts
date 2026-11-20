import { describe, expect, it } from "@jest/globals";
import { PrayerRequest } from "@/data/request";
import { Room } from "@/data/room";
import { sortRooms } from "@/lib/sortRooms";

// A fixed "now" so the tests don't depend on when they run.
const NOW = new Date("2026-11-19T18:00:00Z").getTime();
const MINUTE = 60 * 1000;

// A request starting `minutesFromNow` after NOW (negative = already started).
// With JOIN_GRACE_MINUTES = 2 and EXPIRY_MINUTES = 15:
//   > -2 → pending,  -2 to -15 → in progress,  <= -15 → expired
let nextId = 0;
function request(roomId: string, minutesFromNow: number): PrayerRequest {
  return {
    id: `req-${nextId++}`,
    room_id: roomId,
    start_time: new Date(NOW + minutesFromNow * MINUTE).toISOString(),
  };
}

function room(id: string, building: string): Room {
  return { id, building, is_open: true, floor: "Ground floor", room_num: "001", latitude: 0, longitude: 0, gender: null };
}

const A = room("a", "Alpha Hall");
const B = room("b", "Beta Library");
const C = room("c", "Gamma Center");

// The room ids in the order sortRooms returns them.
const order = (rooms: Room[], requests: PrayerRequest[]) => sortRooms(rooms, requests, NOW).map((g) => g.room.id);

describe("sortRooms", () => {
  it("puts the room with more pending requests first", () => {
    const requests = [request("a", 10), request("b", 10), request("b", 20)];
    expect(order([A, B], requests)).toEqual(["b", "a"]);
  });

  it("ranks pending over in-progress: 2 pending beats 1 pending + 5 in progress", () => {
    const requests = [
      request("a", 10), request("a", 20),                // A: 2 pending
      request("b", 10),                                  // B: 1 pending...
      ...[-3, -4, -5, -6, -7].map((m) => request("b", m)), // ...and 5 in progress
    ];
    expect(order([B, A], requests)).toEqual(["a", "b"]);
  });

  it("breaks a pending tie with the in-progress count", () => {
    const requests = [request("a", 10), request("b", 10), request("b", -5)];
    expect(order([A, B], requests)).toEqual(["b", "a"]);
  });

  it("breaks a full count tie with the earliest start time", () => {
    const requests = [request("a", 30), request("b", 10)];
    expect(order([A, B], requests)).toEqual(["b", "a"]);
  });

  it("breaks a full tie with the building name", () => {
    const requests = [request("b", 10), request("a", 10)];
    expect(order([B, A], requests)).toEqual(["a", "b"]);
  });

  it("puts empty rooms last, alphabetically", () => {
    const requests = [request("c", 10)];
    expect(order([B, C, A], requests)).toEqual(["c", "a", "b"]);
  });

  it("drops expired requests, so a room with only expired ones counts as empty", () => {
    const requests = [request("a", -15), request("a", -30), request("b", 10)];
    const groups = sortRooms([A, B], requests, NOW);
    expect(groups.map((g) => g.room.id)).toEqual(["b", "a"]);
    expect(groups[1].requests).toEqual([]);
  });

  it("sorts each room's requests by start time", () => {
    const late = request("a", 30);
    const early = request("a", 5);
    const inProgress = request("a", -5);
    const [group] = sortRooms([A], [late, early, inProgress], NOW);
    expect(group.requests).toEqual([inProgress, early, late]);
  });

  it("keeps every room even with no requests at all", () => {
    expect(order([A, B], [])).toEqual(["a", "b"]);
  });
});

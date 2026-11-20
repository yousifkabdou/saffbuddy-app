import { PrayerRequest } from "@/data/request";
import { Room } from "@/data/room";
import { isExpired, isInProgress } from "@/lib/requestTime";

// One room in the Requests tab, with its live (not expired) requests, earliest first.
export type RoomGroup = {
  room: Room;
  requests: PrayerRequest[];
};

const startMs = (r: PrayerRequest) => new Date(r.start_time).getTime();

// Groups requests by room and orders the rooms for the Requests tab:
//   1. most pending requests (still joinable) first
//   2. then most in-progress requests
//   3. then the earliest start time
//   4. then building name, so the order is stable
// Expired requests are dropped first, so a room with only expired requests counts as empty.
// Empty rooms end up last: they have 0 pending and 0 in progress.
export function sortRooms(rooms: Room[], requests: PrayerRequest[], now: number): RoomGroup[] {
  const live = requests.filter((r) => !isExpired(r.start_time, now));

  const groups = rooms.map((room) => ({
    room,
    requests: live.filter((r) => r.room_id === room.id).sort((a, b) => startMs(a) - startMs(b)),
  }));

  const pending = (g: RoomGroup) => g.requests.filter((r) => !isInProgress(r.start_time, now)).length;
  const inProgress = (g: RoomGroup) => g.requests.length - pending(g);
  // Empty rooms have no start time; Infinity sorts them after any real one.
  const earliest = (g: RoomGroup) => (g.requests.length > 0 ? startMs(g.requests[0]) : Infinity);

  // A sort comparator returns negative to put a first, positive to put b first, 0 for a tie.
  // `||` moves on to the next rule only when the one before it is a tie (0 is falsy).
  return groups.sort((a, b) =>
    pending(b) - pending(a) ||
    inProgress(b) - inProgress(a) ||
    (earliest(a) === earliest(b) ? 0 : earliest(a) < earliest(b) ? -1 : 1) ||
    a.room.building.localeCompare(b.room.building)
  );
}

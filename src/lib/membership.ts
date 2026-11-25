import { PrayerRequest } from "@/data/request";
import { isExpired } from "@/lib/requestTime";

// What the user is "in" right now, worked out from the loaded data and the clock.
// Every screen picks its buttons from this, so it's a pure function with tests
// (src/lib/__tests__/membership.test.ts) instead of logic buried in a hook.
export type Membership = {
  myRequestRow?: PrayerRequest;     // the user's own request, if it's in the list
  myJoinedRow?: PrayerRequest;      // the request the user joined, if it's in the list
  activeRequestRow?: PrayerRequest; // own request, not Done and not expired: show Cancel/Done
  activeJoinedRow?: PrayerRequest;  // joined request, not Done and not expired: show Leave/Done
  // Finished (Done or expired) but not yet deleted by the server. Until then the database
  // still sees the user in it, so posting or joining would be refused.
  finishingRow?: PrayerRequest;
};

export function membership({ requests, myRequestId, myJoinedId, doneId, now }: {
  requests: PrayerRequest[];
  myRequestId: string | null;
  myJoinedId: string | null;
  doneId: string | null; // the request the user tapped Done on (hidden on this phone only)
  now: number;
}): Membership {
  // undefined if they have none, or if the id is stale and that row is no longer in the list.
  const myRequestRow = requests.find((r) => r.id === myRequestId);
  const myJoinedRow = requests.find((r) => r.id === myJoinedId);

  const isFinished = (row: PrayerRequest) => row.id === doneId || isExpired(row.start_time, now);
  const activeRequestRow = myRequestRow && !isFinished(myRequestRow) ? myRequestRow : undefined;
  const activeJoinedRow = myJoinedRow && !isFinished(myJoinedRow) ? myJoinedRow : undefined;
  const finishingRow = (!activeRequestRow && myRequestRow) || (!activeJoinedRow && myJoinedRow) || undefined;

  return { myRequestRow, myJoinedRow, activeRequestRow, activeJoinedRow, finishingRow };
}

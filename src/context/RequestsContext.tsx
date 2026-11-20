import { Room } from "@/data/room";
import { useRequests } from "@/hooks/useRequests";
import { formatTime, freeAgainAt, isExpired } from "@/lib/requestTime";
import { supabase } from "@/lib/supabase";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { Alert } from "react-native";

// Everything about requests that more than one tab needs to agree on: the data, the clock,
// what the user is in, and the actions. It lives once in the tabs layout and every tab
// reads the same copy. Panel/list UI state (selected room, collapsed groups) stays in each screen.
function useSharedRequestsState() {
  const [rooms, setRooms] = useState<Room[]>([]); // empty until Supabase answers
  const [gender, setGender] = useState<"Men" | "Women" | null>(null);
  // gender (loaded below from profiles) picks the live-update channel
  const requestsState = useRequests(gender);
  const { requests, myRequestId, myJoinedId, joinRequest } = requestsState;
  const [now, setNow] = useState(Date.now()); // the clock, refreshed every 30s so time-based UI updates on its own
  // The request the user tapped Done on. Done deletes nothing: the server deletes the request
  // later and counts it in the tally (docs/adr/0001), so this only hides it on this phone.
  const [doneId, setDoneId] = useState<string | null>(null);
  // A room another tab wants the map to open. The map opens its panel, then sets this back to null,
  // so it acts like a one-time message instead of something that sticks to the screen.
  const [openRoomId, setOpenRoomId] = useState<string | null>(null);
  // The other direction: a room the map wants the Requests tab to scroll to. Same one-time idea.
  const [focusRoomId, setFocusRoomId] = useState<string | null>(null);

  // Re-render every 30 seconds so rows switch to "In progress" and expired ones disappear
  // without a reload. The cleanup stops the timer when the provider unmounts (sign out).
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(timer);
  }, []);

  // Load the rooms once. RLS decides which rooms come back
  // (shared rooms plus the viewer's own gender's rooms).
  useEffect(() => {
    const loadRooms = async () => {
      const { data, error } = await supabase.from("rooms").select("*");
      if (error) {
        console.log(error.message);
        return;
      }
      setRooms(data);
    };
    loadRooms();
  }, []);

  useEffect(() => {
    const getGender = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userID = sessionData.session?.user.id;
      const { data, error } = await supabase.from("profiles").select("gender").eq("id", userID).maybeSingle();
      if (error) {
        console.log(error.message);
        return;
      }
      setGender(data?.gender ?? null);
    };
    getGender();
  }, []);

  // The user's own request and its room, for the red Cancel button. undefined if they have none
  // (or if myRequestId is stale and that row is no longer in the list).
  const myRequestRow = requests.find((r) => r.id === myRequestId);
  const myRequestRoom = rooms.find((room) => room.id === myRequestRow?.room_id);

  // Same idea for the request the user joined, for the "Joined" label and the blocked-Join alert.
  const myJoinedRow = requests.find((r) => r.id === myJoinedId);
  const myJoinedRoom = rooms.find((room) => room.id === myJoinedRow?.room_id);

  // The rows the user is still "in": not tapped Done and not expired. undefined otherwise.
  const isFinished = (row: { id: string; start_time: string }) => row.id === doneId || isExpired(row.start_time, now);
  const activeRequestRow = myRequestRow && !isFinished(myRequestRow) ? myRequestRow : undefined;
  const activeJoinedRow = myJoinedRow && !isFinished(myJoinedRow) ? myJoinedRow : undefined;

  // Finished but not yet deleted by the server. Until then the database still sees the user
  // in it, so posting or joining would be refused.
  const finishingRow = (!activeRequestRow && myRequestRow) || (!activeJoinedRow && myJoinedRow) || undefined;

  // Join tapped on a row. A user can be in only one request, so if they already are,
  // tell them what to do instead of sending an insert the database would refuse anyway.
  const handleJoin = (requestId: string) => {
    if (activeRequestRow) {
      Alert.alert("You already have a request", `Cancel your ${formatTime(activeRequestRow.start_time)} request at ${myRequestRoom?.building} first.`);
      return;
    }
    if (activeJoinedRow) {
      Alert.alert("You already joined a request", `Leave the ${formatTime(activeJoinedRow.start_time)} request at ${myJoinedRoom?.building} first.`);
      return;
    }
    if (finishingRow) {
      Alert.alert("Finishing up your last prayer", `You can join again from ${formatTime(freeAgainAt(finishingRow.start_time))}.`);
      return;
    }
    joinRequest(requestId);
  };

  return {
    ...requestsState,
    rooms, gender, now, doneId, setDoneId, openRoomId, setOpenRoomId, focusRoomId, setFocusRoomId,
    myRequestRoom, myJoinedRoom, activeRequestRow, activeJoinedRow, finishingRow,
    handleJoin,
  };
}

// The context's type is whatever the function above returns, so the two can't drift apart.
type SharedRequests = ReturnType<typeof useSharedRequestsState>;

// null = no provider above. Only happens if a screen outside (tabs) calls useSharedRequests.
const RequestsContext = createContext<SharedRequests | null>(null);

// Runs the state above once and hands it to every screen inside it.
export function RequestsProvider({ children }: { children: ReactNode }) {
  const value = useSharedRequestsState();
  return <RequestsContext.Provider value={value}>{children}</RequestsContext.Provider>;
}

// What screens call. Every caller gets the same object, and re-renders when it changes.
export function useSharedRequests() {
  const value = useContext(RequestsContext);
  if (!value) throw new Error("useSharedRequests must be used inside <RequestsProvider>");
  return value;
}

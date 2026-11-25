import { PrayerRequest } from "@/data/request";
import { ALREADY_STARTED_ERROR, AppError, NOTHING_DELETED_ERROR, RequestAction } from "@/lib/errors";
import { isOffline, OFFLINE_ERROR } from "@/lib/network";
import { isInProgress } from "@/lib/requestTime";
import { supabase } from "@/lib/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

// How long to wait after a ping before refetching, so a burst of pings
// (e.g. the cron job deleting several requests) causes one refetch, not several.
const PING_DEBOUNCE_MS = 300;

// Request data and actions, shared by any screen that shows requests.
// Panel/UI state (which room is open, picker vs. confirm) stays in the screen.
// gender picks the live-update channel; null until the screen has loaded it.
// onActionError is called when post/join/leave/cancel fails, so the caller can tell the user.
export function useRequests(
  gender: "Men" | "Women" | null,
  onActionError: (action: RequestAction, error: AppError) => void,
) {
  const [myRequestId, setMyRequestId] = useState<null | string>(null);
  const [myJoinedId, setMyJoinedId ] = useState<string | null>(null);
  const [requests, setRequests] = useState<PrayerRequest[]>([]); // every request RLS lets us see, all rooms
  const [counts, setCounts] = useState<Record<string, number>>({}); // joiner count by request id; missing = 0
  // Whether the latest load failed. The screens show a retry banner while either is true,
  // and the next successful load (a retry, a live-update ping, the app reopening) clears it.
  const [requestsFailed, setRequestsFailed] = useState(false);
  const [joinsFailed, setJoinsFailed] = useState(false);
  // True once requests and joins have each loaded successfully at least once. Until then the
  // screens show "loading" instead of "no requests", and the panel doesn't offer Request
  // (the user may already have one that just hasn't arrived yet).
  const [requestsLoaded, setRequestsLoaded] = useState(false);
  const [joinsLoaded, setJoinsLoaded] = useState(false);
  // An action (post/join/leave/cancel) is on its way. One flag for all four is enough: the
  // database only lets a user be in one request at a time anyway. The ref is the real guard
  // (it changes immediately, so a fast double tap sees it); the state is for the buttons.
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);

  // Each load takes a number; after every await it checks it's still the newest call.
  // If two loads overlap, the older one stops instead of overwriting newer data.
  const requestsCall = useRef(0);
  const joinsCall = useRef(0);
  const pingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load every visible request (RLS: only the viewer's gender), earliest first.
  // Name the columns: requester is hidden by the column grant, so "*" would fail.
  const loadRequests = async () => {
    const call = ++requestsCall.current;
    const { data, error } = await supabase.from("requests").select("id, room_id, start_time").order("start_time");
    if (call !== requestsCall.current) return; // a newer load started; let it win
    if (error) {
      console.log(error.message);
      setRequestsFailed(true); // keep showing the last list we had, plus the banner
      return;
    }
    setRequests(data);
    const {data: myRequestData, error: myRequestError} = await supabase.rpc("my_request_id");
    if (call !== requestsCall.current) return;
    if(myRequestError){
      console.log(myRequestError.message);
      setRequestsFailed(true);
      return;
    }
    setMyRequestId(myRequestData);
    setRequestsFailed(false); // both parts loaded
    setRequestsLoaded(true);
  };

  // Load join data: how many joined each request, and which request (if any) the user joined.
  // Separate from loadRequests so Join/Leave only refresh this, and a failure here
  // doesn't stop the request list from showing.
  const loadJoins = async () => {
    const call = ++joinsCall.current;
    // request_count() only returns requests of the viewer's gender, and never who joined.
    // It returns [{ request_id, count }, ...]; turn that into { [request_id]: count }
    // so each row can look up its own count directly. Requests with no joiners aren't in it.
    const { data: countData, error: countError } = await supabase.rpc("request_count");
    if (call !== joinsCall.current) return; // a newer load started; let it win
    if (countError) {
      console.log(countError.message);
      setJoinsFailed(true);
    } else {
      setCounts(Object.fromEntries(countData.map((row: { request_id: string; count: number }) => [row.request_id, row.count])));
    }

    const {data: joinersData, error: joinersError} = await supabase.rpc("check_for_member_request");
    if (call !== joinsCall.current) return;
    if (joinersError){
      console.log(joinersError.message);
      setJoinsFailed(true);
      return;
    }
    setMyJoinedId(joinersData);
    if (!countError) {
      setJoinsFailed(false); // both parts loaded
      setJoinsLoaded(true);
    }
  };

  // Runs one action at a time. A second tap while one is on its way does nothing, instead of
  // sending a duplicate that the database refuses ("you already have a request") right as the
  // first one succeeds. finally: the flag clears even if the action throws.
  const runAction = async (action: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await action();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  // Called with the room to post in and one of START_OFFSETS (src/lib/requestTime.ts).
  // post_request() (supabase/joins.sql) fills in the start time from the server's clock, plus the
  // user's id and gender from their login, so a phone clock that's a few minutes off can't make
  // the insert policy refuse it, and a gender that failed to load here doesn't matter.
  const postRequest = (roomID: string, minutes: number) => runAction(async () => {
    if (await isOffline()) return onActionError("post", OFFLINE_ERROR); // fail fast instead of waiting on a doomed fetch
    const { error } = await supabase.rpc("post_request", { room: roomID, minutes });
    if (error){
      console.log(error.message);
      onActionError("post", error);
    }
    await loadRequests(); // refresh the list so the new request shows up (or, on failure, shows why it didn't)
  });

  const joinRequest = (requestId: string) => runAction(async () => {
    if (await isOffline()) return onActionError("join", OFFLINE_ERROR);
    const {data} = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    const {error: insertError } = await supabase.from("joiners").insert({member: userId, request_id: requestId});
    if (insertError){
      console.log(insertError.message);
      onActionError("join", insertError);
    } else {
      // Show it straight away; if the refetch below fails, the screen still shows the truth
      // (otherwise it would offer Join again, and a second tap would be refused).
      setMyJoinedId(requestId);
    }
    await loadJoins();
  });

  // True if the request has passed the join cutoff. Cancel/Leave confirms can stay open past it;
  // the database refuses a late delete anyway, but checking here gives a clearer message.
  const hasStarted = (requestId: string | null) => {
    const row = requests.find((r) => r.id === requestId);
    return row !== undefined && isInProgress(row.start_time, Date.now());
  };

  const leaveRequest = () => runAction(async () => {
    if (hasStarted(myJoinedId)) {
      onActionError("leave", ALREADY_STARTED_ERROR);
      return;
    }
    if (await isOffline()) return onActionError("leave", OFFLINE_ERROR);
    const {data} = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    // .select() makes the delete return the rows it removed, so we can tell "deleted" from "deleted nothing".
    const {data: leftRows, error: leaveError} = await supabase.from("joiners").delete().eq("member", userId).select("member");

    if (leaveError){
      console.log(leaveError.message);
      onActionError("leave", leaveError);
      return;
    }
    // Zero rows: the join was already gone (request cancelled/expired) or a policy refused it
    // (it just started). Either way the user should know, and the refetch below shows the real state.
    if (leftRows.length === 0) onActionError("leave", NOTHING_DELETED_ERROR);
    else setMyJoinedId(null); // left: show it now, like cancel does
    await loadJoins();
  });

  // Deletes the user's own request.
  const cancelRequest = () => runAction(async () => {
    if (hasStarted(myRequestId)) {
      onActionError("cancel", ALREADY_STARTED_ERROR);
      return;
    }
    if (await isOffline()) return onActionError("cancel", OFFLINE_ERROR);
    // Only ask for id back: requester is hidden by the column grant, so .select() with no columns would fail.
    const{data: cancelledRows, error} = await supabase.from("requests").delete().eq("id", myRequestId).select("id");
    if (error){
      console.log(error.message);
      onActionError("cancel", error);
      return;
    }
    if (cancelledRows.length === 0) {
      onActionError("cancel", NOTHING_DELETED_ERROR);
      await loadRequests(); // resync: the rpc says whether we still have a request
      return;
    }
    setMyRequestId(null);
    await loadRequests(); // removes the row from the list; the rpc confirms myRequestId is null
  });

  // Load once when the screen using this hook mounts.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; state is only set after the awaits, when data arrives
    loadRequests();
    loadJoins();
  }, []);

  // Live updates (supabase/live_updates.sql). The database sends an empty "changed" ping to
  // 'requests:<gender>' whenever a request or join is added or removed; we refetch through
  // the normal RLS-checked queries. Pings are lost while the app is backgrounded or offline,
  // so we also refetch whenever the channel (re)connects and when the app comes back to the front.
  useEffect(() => {
    if (!gender) return; // wait until the screen knows which channel to join

    // Many pings in a short burst -> one refetch, PING_DEBOUNCE_MS after the last one.
    const scheduleRefresh = () => {
      if (pingTimer.current) clearTimeout(pingTimer.current);
      pingTimer.current = setTimeout(() => {
        loadRequests();
        loadJoins();
      }, PING_DEBOUNCE_MS);
    };

    let channel: RealtimeChannel | null = null;
    let cancelled = false; // set by cleanup, in case it runs before setAuth finishes

    const subscribe = async () => {
      await supabase.realtime.setAuth(); // send the user's token so the channel policy knows who they are
      if (cancelled) return;
      // private: true -> Realtime checks the realtime.messages policy. Asking for the other
      // gender's channel just fails that check; the policy reads gender from profiles.
      channel = supabase
        .channel(`requests:${gender}`, { config: { private: true } })
        .on("broadcast", { event: "changed" }, scheduleRefresh)
        .subscribe((status, err) => {
          if (status === "SUBSCRIBED") {
            scheduleRefresh(); // first connect and every reconnect: catch anything missed
          } else if (err) {
            console.log(`live updates: ${status}`, err.message);
          }
        });
    };
    subscribe();

    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") scheduleRefresh();
    });

    // Runs when the screen unmounts or gender changes: leave the channel and stop listening,
    // otherwise a remount would add a second channel and every ping would refetch twice.
    return () => {
      cancelled = true;
      if (pingTimer.current) clearTimeout(pingTimer.current);
      appStateSub.remove();
      if (channel) supabase.removeChannel(channel);
    };
  }, [gender]);

  const loaded = requestsLoaded && joinsLoaded;
  return {myJoinedId, requests, myRequestId, counts, requestsFailed, joinsFailed, loaded, busy, leaveRequest, joinRequest, loadRequests, loadJoins, postRequest, cancelRequest };
}

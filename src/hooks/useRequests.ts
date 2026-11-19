import { PrayerRequest } from "@/data/request";
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
export function useRequests(gender: "Men" | "Women" | null) {
  const [myRequestId, setMyRequestId] = useState<null | string>(null);
  const [myJoinedId, setMyJoinedId ] = useState<string | null>(null);
  const [requests, setRequests] = useState<PrayerRequest[]>([]); // every request RLS lets us see, all rooms
  const [counts, setCounts] = useState<Record<string, number>>({}); // joiner count by request id; missing = 0

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
      return;
    }
    setRequests(data);
    const {data: myRequestData, error: myRequestError} = await supabase.rpc("my_request_id");
    if (call !== requestsCall.current) return;
    if(myRequestError){
      console.log(myRequestError.message);
      return;
    }
    setMyRequestId(myRequestData);
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
    } else {
      setCounts(Object.fromEntries(countData.map((row: { request_id: string; count: number }) => [row.request_id, row.count])));
    }

    const {data: joinersData, error: joinersError} = await supabase.rpc("check_for_member_request");
    if (call !== joinsCall.current) return;
    if (joinersError){
      console.log(joinersError.message);
      return;
    }
    setMyJoinedId(joinersData);
  };

  // Called with the room to post in and one of START_OFFSETS.
  const postRequest = async (roomID: string, minutes: number) => {
    const {data} = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    const {data: userGender} = await supabase.from('profiles').select('gender').eq('id', userId).maybeSingle();
    const {error} = await supabase.from("requests").insert({room_id: roomID, requester: userId, gender: userGender?.gender, start_time: new Date(Date.now() + minutes * 60 * 1000).toISOString()})

    if (error){
      console.log(error.message);
    }
    loadRequests(); // refresh the list so the new request shows up
  };

  const joinRequest = async (requestId : string) => {
    const {data} = await supabase.auth.getSession();
    const userId = data.session?.user.id; 
    const {error: insertError } = await supabase.from("joiners").insert({member: userId, request_id: requestId});
    if (insertError){
      console.log(insertError.message);
      
    }
    loadJoins();
  }

  const leaveRequest  = async() => {
    const {data} = await supabase.auth.getSession();
    const userId = data.session?.user.id; 
    const {error: leaveError} = await supabase.from("joiners").delete().eq("member", userId);
    
    if (leaveError){
      console.log(leaveError.message);
      return;
    }
    loadJoins();
  }
  // Deletes the user's own request.
  const cancelRequest = async () => {
    const{error} = await supabase.from("requests").delete().eq("id", myRequestId);
    if (error){
      console.log(error.message);
      return;
    }
    setMyRequestId(null);
    loadRequests(); // removes the row from the list; the rpc confirms myRequestId is null
  };

  // Load once when the screen using this hook mounts.
  useEffect(() => {
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

  return {myJoinedId, requests, myRequestId, counts, leaveRequest, joinRequest, loadRequests, loadJoins, postRequest, cancelRequest };
}

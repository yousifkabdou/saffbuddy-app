import { PrayerRequest } from "@/data/request";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";

// Request data and actions, shared by any screen that shows requests.
// Panel/UI state (which room is open, picker vs. confirm) stays in the screen.
export function useRequests() {
  const [myRequestId, setMyRequestId] = useState<null | string>(null);
  const [myJoinedId, setMyJoinedId ] = useState<string | null>(null);
  const [requests, setRequests] = useState<PrayerRequest[]>([]); // every request RLS lets us see, all rooms
  const [counts, setCounts] = useState<Record<string, number>>({}); // joiner count by request id; missing = 0

  // Load every visible request (RLS: only the viewer's gender), earliest first.
  // Name the columns: requester is hidden by the column grant, so "*" would fail.
  const loadRequests = async () => {
    const { data, error } = await supabase.from("requests").select("id, room_id, start_time").order("start_time");
    if (error) {
      console.log(error.message);
      return;
    }
    setRequests(data);
    const {data: myRequestData, error: myRequestError} = await supabase.rpc("my_request_id");
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
    // request_count() only returns requests of the viewer's gender, and never who joined.
    // It returns [{ request_id, count }, ...]; turn that into { [request_id]: count }
    // so each row can look up its own count directly. Requests with no joiners aren't in it.
    const { data: countData, error: countError } = await supabase.rpc("request_count");
    if (countError) {
      console.log(countError.message);
    } else {
      setCounts(Object.fromEntries(countData.map((row: { request_id: string; count: number }) => [row.request_id, row.count])));
    }

    const {data: joinersData, error: joinersError} = await supabase.rpc("check_for_member_request");
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

  return {myJoinedId, requests, myRequestId, counts, leaveRequest, joinRequest, loadRequests, loadJoins, postRequest, cancelRequest };
}

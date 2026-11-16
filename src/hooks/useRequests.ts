import { PrayerRequest } from "@/data/request";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";

// Request data and actions, shared by any screen that shows requests.
// Panel/UI state (which room is open, picker vs. confirm) stays in the screen.
export function useRequests() {
  const [myRequestId, setMyRequestId] = useState<null | string>(null);
  const [requests, setRequests] = useState<PrayerRequest[]>([]); // every request RLS lets us see, all rooms

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
  }, []);

  return { requests, myRequestId, loadRequests, postRequest, cancelRequest };
}

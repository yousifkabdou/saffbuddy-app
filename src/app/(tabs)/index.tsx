import { Room } from "@/data/room";
import { useRequests } from "@/hooks/useRequests";
import { supabase } from "@/lib/supabase";
import { isExpired, isInProgress } from "@/lib/requestTime";
import { otherPerson } from "@/lib/wording";
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { useEffect, useRef, useState } from "react";
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { MapMarker, Marker } from "react-native-maps";

// Start time choices, in minutes from now. No "Now": a request needs a few minutes
// for anyone to see it and walk over. The requests insert policy only accepts
// start times 5-45 minutes ahead (with 1 min slack), so keep these in sync.
const START_OFFSETS = [5, 10, 15, 30, 45];

// Opens walking directions to a room in the user's map app.
// iOS asks Apple Maps or Google Maps; Android goes straight to Google Maps.
function openDirections(room: Room) {
  const destination = `${room.latitude},${room.longitude}`;
  const appleUrl = `https://maps.apple.com/?daddr=${destination}&dirflg=w`;
  const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=walking`;

  if (Platform.OS === "ios") {
    Alert.alert("Directions", "Open in:", [
      { text: "Apple Maps", onPress: () => Linking.openURL(appleUrl) },
      { text: "Google Maps", onPress: () => Linking.openURL(googleUrl) },
      { text: "Cancel", style: "cancel" },
    ]);
  } else {
    Linking.openURL(googleUrl);
  }
}

// "2026-11-11T18:02:00Z" -> "1:02 PM" in the phone's time zone.
function formatTime(isoTime: string) {
  return new Date(isoTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function Index() {
  const [rooms, setRooms] = useState<Room[]>([]); // empty until Supabase answers, so the map shows with no markers at first
  const [selectedRoom, setSelectedRoom] = useState<null | Room>(null);
  const tabBarHeight = useBottomTabBarHeight(); // the tab bar floats over the screen, so the panel needs room for it
  const markerRefs = useRef<Record<string, MapMarker | null>>({}); // each room's marker, by room id
  const { requests, myRequestId, myJoinedId, counts, postRequest, cancelRequest, joinRequest, leaveRequest } = useRequests();
  const [requestsOpen, setRequestsOpen] = useState(false); // true = the panel shows this room's request list
  const [panelMode, setPanelMode] = useState<"buttons" | "picker" | "cancel" | "leave">("buttons");
  const [gender, setGender] = useState<"Men"|"Women"|null>(null);
  const [now, setNow] = useState(Date.now()); // the clock, refreshed every 30s so time-based UI updates on its own

  // Re-render every 30 seconds so rows switch to "In progress" and expired ones disappear
  // without a reload. The cleanup stops the timer when the screen unmounts.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(timer);
  }, []);

  // Only the selected room's requests that haven't expired. Filtered here (not in loadRequests)
  // so a request that expires while the screen is open disappears on the next tick.
  // Already sorted by start time (see loadRequests).
  const roomRequests = selectedRoom
    ? requests.filter((r) => r.room_id === selectedRoom.id && !isExpired(r.start_time, now))
    : [];

  // The user's own request and its room, for the red Cancel button. undefined if they have none
  // (or if myRequestId is stale and that row is no longer in the list).
  const myRequestRow = requests.find((r) => r.id === myRequestId);
  const myRequestRoom = rooms.find((room) => room.id === myRequestRow?.room_id);

  // Same idea for the request the user joined, for the "Joined" label and the blocked-Join alert.
  const myJoinedRow = requests.find((r) => r.id === myJoinedId);
  const myJoinedRoom = rooms.find((room) => room.id === myJoinedRow?.room_id);

  // Join tapped on a row. A user can be in only one request, so if they already are,
  // tell them what to do instead of sending an insert the database would refuse anyway.
  const handleJoin = (requestId: string) => {
    if (myRequestRow) {
      Alert.alert("You already have a request", `Cancel your ${formatTime(myRequestRow.start_time)} request at ${myRequestRoom?.building} first.`);
      return;
    }
    if (myJoinedRow) {
      Alert.alert("You already joined a request", `Leave the ${formatTime(myJoinedRow.start_time)} request at ${myJoinedRoom?.building} first.`);
      return;
    }
    joinRequest(requestId);
  };

  // Open a room's panel with the picker, list and confirm closed, so they don't carry over from the last room.
  const openPanel = (room: Room) => {
    setPanelMode("buttons");
    setSelectedRoom(room);
    setRequestsOpen(false);
  };

  // Close the panel and deselect the marker right away. Otherwise Apple Maps keeps
  // it selected for ~1s and ignores taps on it, so it can't be reopened.
  const closePanel = () => {
    if (selectedRoom) {
      markerRefs.current[selectedRoom.id]?.hideCallout();
    }
    setSelectedRoom(null);
    setRequestsOpen(false);
  };

  // Load the rooms once when the map opens. RLS decides which rooms come back
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

  useEffect( () =>{
    const getGender = async () => {
      const {data: sessionData} = await supabase.auth.getSession();
      const userID = sessionData.session?.user.id;
      const {data, error} = await supabase.from("profiles").select("gender").eq("id", userID).maybeSingle();
      if (error){
        console.log(error.message);
        return;
      }
      setGender(data?.gender??null);
    };
    getGender();
  }, []);

  return (

    <View style={styles.container}>
      <MapView style={styles.map}
      initialRegion={{
        latitude: 40.000632,
        longitude: -83.013325,
        latitudeDelta: 0.013,
        longitudeDelta: 0.013,
      }}
      onPress={(event) => {
        // Tapping a marker can also reach the map; only close for taps on empty map.
        if (event.nativeEvent.action !== "marker-press") {
          closePanel();
        }
      }}>
      {rooms.map((room) => (
      <Marker key = {room.id}
      ref={(marker) => { markerRefs.current[room.id] = marker; }}
      coordinate =
      {{latitude: room.latitude, longitude: room.longitude }}
      onPress={ () => openPanel(room)}
      // After a map tap closes the panel, Apple Maps selects the next marker
      // without firing onPress, so open the panel on select too.
      onSelect={ () => openPanel(room)}/>
    ))}
      </MapView>
      {selectedRoom &&
      <View style={[styles.panel, { paddingBottom: tabBarHeight }]}>
        <Pressable style={styles.closeButton} onPress={closePanel}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>

        <View style={styles.header}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>🕌</Text>
          </View>
          <Text style={styles.name}>{selectedRoom.building}</Text>
        </View>

        <View style={styles.descriptionRow}>
          <Text style={styles.description}>
            { `${selectedRoom.floor}, Room ${selectedRoom.room_num}`}
          </Text>
          {roomRequests.length > 0 &&
          <Pressable onPress={() => setRequestsOpen(!requestsOpen)}>
            <Text style={styles.requestsLink}>
              {requestsOpen ? "Hide requests" : "Check current requests"}
            </Text>
          </Pressable>}
        </View>

        {requestsOpen && roomRequests.map((request) => (
          <View key={request.id} style={styles.requestRow}>
            <Text style={styles.requestTime}>
              {request.id === myRequestId && <Text style={styles.yoursLabel}>Yours · </Text>}
              {request.id === myJoinedId && <Text style={styles.yoursLabel}>Joined · </Text>}
              {formatTime(request.start_time)}
            </Text>
            <View style={styles.rowRight}>
              {/* counts holds joiners only; + 1 adds the requester */}
              <Text style={styles.joinCount}>Total members: {(counts[request.id] ?? 0) + 1}</Text>
              {/* Past the join cutoff nobody can join (the joiners insert policy refuses it too) */}
              {isInProgress(request.start_time, now) ?
              <Text style={styles.inProgressText}>In progress</Text>
              : request.id !== myRequestId && request.id !== myJoinedId &&
              <Pressable style={styles.joinButton} onPress={() => handleJoin(request.id)}>
                <Text style={styles.joinText}>Join</Text>
              </Pressable>}
            </View>
          </View>
        ))}

        {panelMode === "cancel" ?
        <View style={styles.actions}>
          <View style={styles.confirmTextBox}>
            <Text style={styles.confirmText}>Cancel your request?</Text>
            <Text style={styles.warningText}>
              You're cancelling on {otherPerson(gender)}. Be considerate of others' time.
            </Text>
          </View>
          <Pressable style={styles.confirmYes} onPress={() => { setPanelMode("buttons"); cancelRequest(); }}>
            <Text style={styles.timeText}>Yes</Text>
          </Pressable>
          <Pressable style={styles.confirmNo} onPress={() => setPanelMode("buttons")}>
            <Text style={styles.confirmNoText}>No</Text>
          </Pressable>
        </View>
        : panelMode === "leave" ?
        <View style={styles.actions}>
          <View style={styles.confirmTextBox}>
            <Text style={styles.confirmText}>Leave this request?</Text>
            <Text style={styles.warningText}>
              Remember, {otherPerson(gender)} is expecting you.
            </Text>
          </View>
          <Pressable style={styles.confirmYes} onPress={() => { setPanelMode("buttons"); leaveRequest(); }}>
            <Text style={styles.timeText}>Yes</Text>
          </Pressable>
          <Pressable style={styles.confirmNo} onPress={() => setPanelMode("buttons")}>
            <Text style={styles.confirmNoText}>No</Text>
          </Pressable>
        </View>
        : panelMode === "picker" ?
        <View style={styles.actions}>
          <Text style={styles.whenText}>When?</Text>
          {START_OFFSETS.map((minutes) => (
            <Pressable key={minutes} style={styles.timeButton} onPress={() => { setPanelMode("buttons"); postRequest(selectedRoom.id, minutes); }}>
              <Text style={styles.timeText}>{minutes}</Text>
              <Text style={styles.timeUnit} numberOfLines={1} adjustsFontSizeToFit>min</Text>
            </Pressable>
          ))}
          <Pressable style={styles.pickerClose} onPress={() => setPanelMode("buttons")}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>
        :
        <View style={styles.actions}>
          <Pressable style={styles.directionsButton} onPress={() => openDirections(selectedRoom)}>
            <Text style={styles.directionsText}>➤</Text>
          </Pressable>
          {/* Once a request is in progress, the prayer is happening: "Done" ends it with no warning */}
          {myRequestRow && isInProgress(myRequestRow.start_time, now) ?
          <Pressable style={[styles.requestButton, styles.doneButton]} onPress={cancelRequest}>
            <Text style={styles.cancelTitle} numberOfLines={1} adjustsFontSizeToFit>
              Done<Text style={styles.doneBlessing}> · May Allah accept your prayer</Text>
            </Text>
            <Text style={styles.cancelDetail} numberOfLines={1}>
              {myRequestRoom?.building} · {formatTime(myRequestRow.start_time)}
            </Text>
          </Pressable>
          : myRequestRow ?
          <Pressable
            style={[styles.requestButton, styles.cancelButton]}
            // Only warn when someone joined; with no joiners, cancelling affects nobody.
            onPress={() => ((counts[myRequestRow.id] ?? 0) > 0 ? setPanelMode("cancel") : cancelRequest())}>
            <Text style={styles.cancelTitle} numberOfLines={1}>Cancel to start a new request</Text>
            <Text style={styles.cancelDetail} numberOfLines={1}>
              {myRequestRoom?.building} · {formatTime(myRequestRow.start_time)}
            </Text>
          </Pressable>
          : myJoinedRow && isInProgress(myJoinedRow.start_time, now) ?
          <Pressable style={[styles.requestButton, styles.doneButton]} onPress={leaveRequest}>
            <Text style={styles.cancelTitle} numberOfLines={1} adjustsFontSizeToFit>
              Done<Text style={styles.doneBlessing}> · May Allah accept your prayer</Text>
            </Text>
            <Text style={styles.cancelDetail} numberOfLines={1}>
              {myJoinedRoom?.building} · {formatTime(myJoinedRow.start_time)}
            </Text>
          </Pressable>
          : myJoinedRow ?
          <Pressable style={[styles.requestButton, styles.cancelButton]} onPress={() => setPanelMode("leave")}>
            <Text style={styles.cancelTitle} numberOfLines={1}>Leave request</Text>
            <Text style={styles.cancelDetail} numberOfLines={1}>
              {myJoinedRoom?.building} · {formatTime(myJoinedRow.start_time)}
            </Text>
          </Pressable>
          :
          <Pressable style={styles.requestButton} onPress={() => setPanelMode("picker")}>
            <Text style={styles.requestText}>Request</Text>
          </Pressable>}
        </View>}
      </View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
    map: {
    width: '100%',
    height: '100%',
  },
  panel: {
    position: "absolute",   // float on top, out of the normal layout
    bottom: 0,              // glued to the bottom edge
    left: 0,                // stretch from the left edge...
    right: 0,               // ...to the right edge
                            // no top: the panel is as tall as its content

    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,

    // shadow (iOS)
    shadowColor: "black",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },   // negative height = shadow goes upward

    // shadow (Android)
    elevation: 10,
  },
  closeButton: {
    position: "absolute",   // pinned to the panel's top-right corner
    top: 12,
    right: 12,
    padding: 8,
    zIndex: 1,              // stay tappable above the header row
  },
  closeText: {
    fontSize: 18,
    color: "gray",
  },
  header: {
    flexDirection: "row",   // logo and name side by side
    alignItems: "center",
    marginTop: 8,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 32,       // half the width = circle
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  logoText: {
    fontSize: 32,
  },
  name: {
    flex: 1,                // take the rest of the row; long names wrap
    fontSize: 22,
    fontWeight: "bold",
  },
  descriptionRow: {
    flexDirection: "row",   // room text on the left, link on the right
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
  },
  description: {
    color: "gray",
  },
  requestsLink: {
    color: "#1a73e8",
    fontWeight: "bold",
  },
  requestRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  requestTime: {
    fontSize: 16,
  },
  yoursLabel: {
    fontWeight: "bold",
  },
  joinCount: {
    color: "gray",
  },
  rowRight: {
    flexDirection: "row",   // count and Join button side by side
    alignItems: "center",
  },
  joinButton: {
    marginLeft: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "black",
  },
  joinText: {
    color: "white",
    fontWeight: "bold",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 12,
  },
  directionsButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  directionsText: {
    fontSize: 20,
  },
  requestButton: {
    flex: 1,                // stretch across the rest of the row
    height: 52,
    borderRadius: 26,
    backgroundColor: "black",
    alignItems: "center",
    justifyContent: "center",
  },
  requestText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  whenText: {
    fontSize: 16,
    fontWeight: "bold",
    marginRight: 8,
  },
  timeButton: {
    flex: 1,                // the five buttons share the row equally
    height: 52,
    borderRadius: 26,
    backgroundColor: "black",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  timeText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  timeUnit: {
    color: "white",
    fontSize: 10,
    paddingHorizontal: 4,   // keeps the word off the rounded edges
  },
  pickerClose: {
    padding: 8,
  },
  cancelButton: {
    backgroundColor: "#d93025",   // red: you're in a request
    paddingHorizontal: 16,
  },
  doneButton: {
    backgroundColor: "#1e8e3e",   // green: the prayer is happening, nothing to warn about
    paddingHorizontal: 16,
  },
  doneBlessing: {
    fontWeight: "normal",
  },
  inProgressText: {
    color: "#1e8e3e",
    fontWeight: "bold",
    marginLeft: 12,
  },
  cancelTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  cancelDetail: {
    color: "white",
    fontSize: 12,
    opacity: 0.85,
  },
  confirmTextBox: {
    flex: 1,
    marginRight: 8,
  },
  confirmText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  warningText: {
    fontSize: 13,
    color: "#555",
    marginTop: 2,
  },
  confirmYes: {
    height: 52,
    paddingHorizontal: 24,
    borderRadius: 26,
    backgroundColor: "#d93025",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  confirmNo: {
    height: 52,
    paddingHorizontal: 24,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmNoText: {
    fontSize: 16,
    fontWeight: "bold",
  },
});

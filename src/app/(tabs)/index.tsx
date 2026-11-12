import { PrayerRequest } from "@/data/request";
import { Room } from "@/data/room";
import { supabase } from "@/lib/supabase";
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { useEffect, useRef, useState } from "react";
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { MapMarker, Marker } from "react-native-maps";

// Start time choices, in minutes from now. The requests insert policy only
// accepts start times up to 60 minutes ahead, so keep these in sync.
const START_OFFSETS = [0, 15, 30, 45, 60];

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

export default function Index() {
  const [rooms, setRooms] = useState<Room[]>([]); // empty until Supabase answers, so the map shows with no markers at first
  const [selectedRoom, setSelectedRoom] = useState<null | Room>(null);
  const tabBarHeight = useBottomTabBarHeight(); // the tab bar floats over the screen, so the panel needs room for it
  const markerRefs = useRef<Record<string, MapMarker | null>>({}); // each room's marker, by room id
  const [timePickerOpen, setTimePickerOpen] = useState(false); // true = time buttons replace the Request button
  const [myRequest, setMyRequest] = useState<null | string>(null);
  const [requests, setRequests] = useState<PrayerRequest[]>([]); // every request RLS lets us see, all rooms
  const [requestsOpen, setRequestsOpen] = useState(false); // true = the panel shows this room's request list

  // Only the selected room's requests. Already sorted by start time (see loadRequests).
  const roomRequests = selectedRoom ? requests.filter((r) => r.room_id === selectedRoom.id) : [];

  // Open a room's panel with the picker and list closed, so they don't carry over from the last room.
  const openPanel = (room: Room) => {
    setSelectedRoom(room);
    setTimePickerOpen(false);
    setRequestsOpen(false);
  };

  // Close the panel and deselect the marker right away. Otherwise Apple Maps keeps
  // it selected for ~1s and ignores taps on it, so it can't be reopened.
  const closePanel = () => {
    if (selectedRoom) {
      markerRefs.current[selectedRoom.id]?.hideCallout();
    }
    setSelectedRoom(null);
    setTimePickerOpen(false);
    setRequestsOpen(false);
  };

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
    setMyRequest(myRequestData);
  };

  // Called with one of START_OFFSETS when a time button is tapped.
  const postRequest = async (minutes: number) => {
    setTimePickerOpen(false);
    const {data} = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    const roomID = selectedRoom?.id;
    const {data: userGender} = await supabase.from('profiles').select('gender').eq('id', userId).maybeSingle();
    const {error} = await supabase.from("requests").insert({room_id: roomID, requester: userId, gender: userGender?.gender, start_time: new Date(Date.now() + minutes * 60 * 1000).toISOString()})
    
    if (error){
      console.log(error.message);
    }
    loadRequests(); // refresh the list so the new request shows up
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
    loadRequests();
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
              {request.id === myRequest && <Text style={styles.yoursLabel}>Yours · </Text>}
              {new Date(request.start_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </Text>
            <Text style={styles.joinCount}>0 joined</Text>
          </View>
        ))}

        {timePickerOpen ?
        <View style={styles.actions}>
          <Text style={styles.whenText}>When?</Text>
          {START_OFFSETS.map((minutes) => (
            <Pressable key={minutes} style={styles.timeButton} onPress={() => postRequest(minutes)}>
              <Text style={styles.timeText}>{minutes === 0 ? "Now" : minutes}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.pickerClose} onPress={() => setTimePickerOpen(false)}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>
        :
        <View style={styles.actions}>
          <Pressable style={styles.directionsButton} onPress={() => openDirections(selectedRoom)}>
            <Text style={styles.directionsText}>➤</Text>
          </Pressable>
          <Pressable style={styles.requestButton} onPress={() => setTimePickerOpen(true)}>
            <Text style={styles.requestText}>Request</Text>
          </Pressable>
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
  pickerClose: {
    padding: 8,
  },
});

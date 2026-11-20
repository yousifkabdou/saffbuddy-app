import { useSharedRequests } from "@/context/RequestsContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Room } from "@/data/room";
import { openDirections } from "@/lib/directions";
import { formatTime, freeAgainAt, isExpired, isInProgress } from "@/lib/requestTime";
import { otherPerson } from "@/lib/wording";
import { useRouter } from "expo-router";
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { MapMarker, Marker } from "react-native-maps";

// Start time choices, in minutes from now. No "Now": a request needs a few minutes
// for anyone to see it and walk over. The requests insert policy only accepts
// start times 5-45 minutes ahead (with 1 min slack), so keep these in sync.
const START_OFFSETS = [5, 10, 15, 30, 45];

// After a marker tap, how long a selection of a *different* marker is treated as Apple Maps noise.
const TAP_WINS_MS = 500;

export default function Index() {
  const [selectedRoom, setSelectedRoom] = useState<null | Room>(null);
  const tabBarHeight = useBottomTabBarHeight(); // the tab bar floats over the screen, so the panel needs room for it
  const markerRefs = useRef<Record<string, MapMarker | null>>({}); // each room's marker, by room id
  const mapRef = useRef<MapView | null>(null); // the map itself, so code can move it
  // The last marker the user actually tapped, and when. A ref: it only guides onSelect, nothing renders from it.
  const lastPress = useRef<{ roomId: string; at: number } | null>(null);
  // Request data, the clock and Done live in RequestsProvider (tabs layout) so every tab shares one copy.
  const {
    rooms, gender, now, requests, counts, setDoneId,
    myRequestRoom, myJoinedRoom, activeRequestRow, activeJoinedRow, finishingRow,
    postRequest, cancelRequest, leaveRequest, loadRequests, loadJoins,
    openRoomId, setOpenRoomId, setFocusRoomId,
  } = useSharedRequests();
  const router = useRouter();
  const [panelMode, setPanelMode] = useState<"buttons" | "picker" | "cancel" | "leave">("buttons");

  // Whether the selected room has any requests that haven't expired, for the "Check current requests" link.
  // Checked against the clock (not just the list) so the link disappears once the last one expires.
  const roomHasRequests = selectedRoom !== null &&
    requests.some((r) => r.room_id === selectedRoom.id && !isExpired(r.start_time, now));

  // Open a room's panel with the picker and confirm closed, so they don't carry over from the last room.
  const openPanel = (room: Room) => {
    setPanelMode("buttons");
    setSelectedRoom(room);
  };

  // Close the panel and deselect the marker right away. Otherwise Apple Maps keeps
  // it selected for ~1s and ignores taps on it, so it can't be reopened.
  const closePanel = () => {
    if (selectedRoom) {
      markerRefs.current[selectedRoom.id]?.hideCallout();
    }
    setSelectedRoom(null);
  };

  // Another tab asked to open a room (Requests tab → tap an empty room). Runs when openRoomId
  // changes, and again when rooms load, in case the request came before the rooms were loaded.
  useEffect(() => {
    if (!openRoomId) return;
    const room = rooms.find((r) => r.id === openRoomId);
    if (!room) return; // rooms not loaded yet; this effect runs again when they are
    openPanel(room);
    // Move the map to the room. The centre sits a bit south of it, so the pin
    // shows above the panel instead of behind it.
    mapRef.current?.animateToRegion(
      { latitude: room.latitude - 0.0015, longitude: room.longitude, latitudeDelta: 0.006, longitudeDelta: 0.006 },
      400,
    );
    setOpenRoomId(null); // handled: clear it so it doesn't reopen next time the map renders
  }, [openRoomId, rooms]);

  return (

    <View style={styles.container}>
      <MapView style={styles.map}
      ref={mapRef}
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
      onPress={ () => {
        lastPress.current = { roomId: room.id, at: Date.now() };
        openPanel(room);
      }}
      // After a map tap closes the panel, Apple Maps selects the next marker
      // without firing onPress, so open the panel on select too.
      onSelect={ () => {
        // Zoomed out, Apple Maps sometimes selects a nearby marker right after the tapped one,
        // with no tap behind it. A tap wins for a moment: ignore a different room selected just after.
        const press = lastPress.current;
        if (press && press.roomId !== room.id && Date.now() - press.at < TAP_WINS_MS) {
          // Deselect it too, or Apple Maps keeps it selected and ignores the next real tap on it.
          markerRefs.current[room.id]?.hideCallout();
          return;
        }
        openPanel(room);
      }}/>
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
          {/* Joining happens in the Requests tab: this jumps there and scrolls to this room. */}
          {roomHasRequests &&
          <Pressable onPress={() => { setFocusRoomId(selectedRoom.id); router.navigate("/requests"); }}>
            <Text style={styles.requestsLink}>Check current requests</Text>
          </Pressable>}
        </View>

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
            <Ionicons name="location" size={24} color="#1a73e8" />
          </Pressable>
          {/* Once a request is in progress, the prayer is happening: "Done" ends it with no warning.
              Done only hides it here; deleting would lose it from the tally. */}
          {activeRequestRow && isInProgress(activeRequestRow.start_time, now) ?
          <Pressable style={[styles.requestButton, styles.doneButton]} onPress={() => setDoneId(activeRequestRow.id)}>
            <Text style={styles.cancelTitle} numberOfLines={1} adjustsFontSizeToFit>
              Done<Text style={styles.doneBlessing}> · May Allah accept your prayer</Text>
            </Text>
            <Text style={styles.cancelDetail} numberOfLines={1}>
              {myRequestRoom?.building} · {formatTime(activeRequestRow.start_time)}
            </Text>
          </Pressable>
          : activeRequestRow ?
          <Pressable
            style={[styles.requestButton, styles.cancelButton]}
            // Only warn when someone joined; with no joiners, cancelling affects nobody.
            onPress={() => ((counts[activeRequestRow.id] ?? 0) > 0 ? setPanelMode("cancel") : cancelRequest())}>
            <Text style={styles.cancelTitle} numberOfLines={1}>Cancel to start a new request</Text>
            <Text style={styles.cancelDetail} numberOfLines={1}>
              {myRequestRoom?.building} · {formatTime(activeRequestRow.start_time)}
            </Text>
          </Pressable>
          : activeJoinedRow && isInProgress(activeJoinedRow.start_time, now) ?
          <Pressable style={[styles.requestButton, styles.doneButton]} onPress={() => setDoneId(activeJoinedRow.id)}>
            <Text style={styles.cancelTitle} numberOfLines={1} adjustsFontSizeToFit>
              Done<Text style={styles.doneBlessing}> · May Allah accept your prayer</Text>
            </Text>
            <Text style={styles.cancelDetail} numberOfLines={1}>
              {myJoinedRoom?.building} · {formatTime(activeJoinedRow.start_time)}
            </Text>
          </Pressable>
          : activeJoinedRow ?
          <Pressable style={[styles.requestButton, styles.cancelButton]} onPress={() => setPanelMode("leave")}>
            <Text style={styles.cancelTitle} numberOfLines={1}>Leave request</Text>
            <Text style={styles.cancelDetail} numberOfLines={1}>
              {myJoinedRoom?.building} · {formatTime(activeJoinedRow.start_time)}
            </Text>
          </Pressable>
          : finishingRow ?
          // Waiting for the server to delete it. Tapping re-fetches; once it's gone,
          // myRequestId/myJoinedId come back null and the normal Request button returns.
          <Pressable style={[styles.requestButton, styles.finishingButton]} onPress={() => { loadRequests(); loadJoins(); }}>
            <Text style={styles.cancelTitle} numberOfLines={1}>Finishing up · tap to refresh</Text>
            <Text style={styles.cancelDetail} numberOfLines={1}>
              You can request again from {formatTime(freeAgainAt(finishingRow.start_time))}
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
  finishingButton: {
    backgroundColor: "#80868b",   // grey: nothing to do but wait
    paddingHorizontal: 16,
  },
  doneBlessing: {
    fontWeight: "normal",
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

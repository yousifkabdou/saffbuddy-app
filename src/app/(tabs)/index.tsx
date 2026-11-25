import CampusIcon from "@/components/CampusIcon";
import MarkerPin, { MarkerDot } from "@/components/MarkerPin";
import { colors } from "@/theme";
import PrayerCountdown from "@/components/PrayerCountdown";
import { useSharedRequests } from "@/context/RequestsContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Room } from "@/data/room";
import { openDirections } from "@/lib/directions";
import { formatTime, freeAgainAt, isExpired, isInProgress, START_OFFSETS } from "@/lib/requestTime";
import { otherPerson } from "@/lib/wording";
import { useRouter } from "expo-router";
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, AppState, Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/AppText";
import MapView, { MapMarker, Marker } from "react-native-maps";
import * as Location from "expo-location";
import { GlassView } from "expo-glass-effect";

// Where the map starts, and where the campus button takes you back to.
const CAMPUS_REGION = { latitude: 40.000632, longitude: -83.013325, latitudeDelta: 0.013, longitudeDelta: 0.013 };

// Zoomed out past this (latitudeDelta, degrees of latitude visible), markers shrink to dots
// so nearby rooms stop overlapping. The starting view is 0.013.
const DOT_ZOOM_DELTA = 0.03;

// After a marker tap, how long a selection of a *different* marker is treated as Apple Maps noise.
const TAP_WINS_MS = 1000;

// The open room's marker draws above every other marker, even one Apple Maps has selected.
// On iOS, react-native-maps adds 999 to a selected marker's zIndex (AIR_CALLOUT_OPEN_ZINDEX_BASELINE
// in AIRMapMarker.m). About 500ms after a tap, Apple Maps can select a neighbouring marker the user
// didn't tap; we deselect it, but until then it sat at its zIndex + 999 and flashed on top of the
// open room. This must stay above 999 + the highest resting zIndex (the number of rooms).
const OPEN_ROOM_Z_INDEX = 10_000;

export default function Index() {
  const [selectedRoom, setSelectedRoom] = useState<null | Room>(null);
  const tabBarHeight = useBottomTabBarHeight(); // the tab bar floats over the screen, so the panel needs room for it
  const markerRefs = useRef<Record<string, MapMarker | null>>({}); // each room's marker, by room id
  const mapRef = useRef<MapView | null>(null); // the map itself, so code can move it
  // The last marker the user actually tapped, and when. A ref: it only guides onSelect, nothing renders from it.
  const lastPress = useRef<{ roomId: string; at: number } | null>(null);
  // Request data, the clock and Done live in RequestsProvider (tabs layout) so every tab shares one copy.
  const {
    rooms, gender, now, requests, counts, markDone,
    myRequestRoom, myJoinedRoom, activeRequestRow, activeJoinedRow, finishingRow,
    postRequest, cancelRequest, leaveRequest, loadRequests, loadJoins, busy, loaded,
    openRoomId, setOpenRoomId, setFocusRoomId, showToast,
  } = useSharedRequests();
  const router = useRouter();
  const [panelMode, setPanelMode] = useState<"buttons" | "picker" | "cancel" | "leave">("buttons");
  // Location (docs/adr/0002): the map draws the blue dot. The latest position is kept in a ref,
  // in memory only, so the recenter button can move the map. Never put it in state/context,
  // log it, or send it anywhere.
  const [locationAllowed, setLocationAllowed] = useState(false);
  const userLocation = useRef<{ latitude: number; longitude: number } | null>(null);
  // Whether markers are drawn as small dots. Only flips when crossing DOT_ZOOM_DELTA;
  // setting the same boolean again doesn't re-render.
  const [zoomedOut, setZoomedOut] = useState(false);

  // Fly the map to the user. A camera move (vs. a region move) is MapKit's smoother "fly" animation,
  // closer to Apple Maps' own locate button. iOS ignores the duration; MapKit picks the speed.
  // It replaces any move already in progress, so it also works while the map is still gliding.
  const recenter = () => {
    if (!userLocation.current) {
      // No fix yet: just opened, GPS warming up indoors, or Location Services off.
      showToast("Can't find your location right now.");
      return;
    }
    // altitude (metres above the map) sets the zoom on Apple Maps; ~1000m shows a few blocks.
    mapRef.current?.animateCamera({ center: userLocation.current, altitude: 1000, heading: 0, pitch: 0 });
    setZoomedOut(false); // our own camera moves don't fire onRegionChangeComplete on iOS, so set it here
  };

  // Ask once for "while using the app" permission. Denied = no dot and no recenter button.
  useEffect(() => {
    // Asks only the first time (when the user hasn't decided yet). After that it just reads the
    // current setting, on mount and whenever the app comes back to the front, so turning location
    // on or off in Settings takes effect without restarting the app.
    const check = async () => {
      try {
        let { granted, canAskAgain, status } = await Location.getForegroundPermissionsAsync();
        if (status === "undetermined" && canAskAgain) {
          ({ granted } = await Location.requestForegroundPermissionsAsync());
        }
        setLocationAllowed(granted);
        if (!granted) userLocation.current = null; // don't fly to a position from before it was turned off
      } catch (e) {
        console.log("location permission check failed", e);
        setLocationAllowed(false);
        userLocation.current = null;
      }
    };
    check();
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => appState.remove();
  }, []);

  // Each marker's zIndex when it isn't open: rooms further south draw in front (a pin lower on the
  // screen looks nearer). Every marker gets its own number so Apple Maps never breaks a tie. With
  // ties (all 0), it used its own order, which a stray selection had changed, so closing the panel
  // flashed the neighbour on top of the room you just closed until Apple re-sorted.
  // Known and accepted (2026-11-24): when closing a room that overlaps a neighbour, its pin can still
  // blink for a frame before settling. Likely MapKit and react-native-maps both setting the layer's
  // zPosition during the deselect; not worth a native patch.
  const restingZIndex = useMemo(() => {
    const northToSouth = [...rooms].sort((a, b) => b.latitude - a.latitude || a.id.localeCompare(b.id));
    return Object.fromEntries(northToSouth.map((r, i) => [r.id, i + 1]));
  }, [rooms]);

  // A Cancel/Leave confirm only makes sense while that request can still be cancelled or left.
  // If it starts (or disappears) while the confirm is open, show the buttons again, which now
  // offer Done. Worked out on every render from the clock, so no effect is needed.
  const canCancel = activeRequestRow !== undefined && !isInProgress(activeRequestRow.start_time, now);
  const canLeave = activeJoinedRow !== undefined && !isInProgress(activeJoinedRow.start_time, now);
  const mode =
    (panelMode === "cancel" && !canCancel) || (panelMode === "leave" && !canLeave) ? "buttons" : panelMode;

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
    // The tap happened on another tab, but the panel state lives here, so an effect is how this
    // screen hears about it. Costs one extra render per tap; the alternative is moving the panel
    // state into the shared context, which couples the screens for no visible gain.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    openPanel(room);
    // Move the map to the room. The centre sits a bit south of it, so the pin
    // shows above the panel instead of behind it.
    setZoomedOut(false); // zooming in to the room (see recenter for why it's set by hand)
    mapRef.current?.animateToRegion(
      { latitude: room.latitude - 0.0015, longitude: room.longitude, latitudeDelta: 0.006, longitudeDelta: 0.006 },
      400,
    );
    setOpenRoomId(null); // handled: clear it so it doesn't reopen next time the map renders
  }, [openRoomId, rooms, setOpenRoomId]);

  return (

    <View style={styles.container}>
      <MapView style={styles.map}
      ref={mapRef}
      // Toned-down Apple map: muted colours, no shops/restaurants, flat buildings, so the pins stand out.
      mapType="mutedStandard"
      showsPointsOfInterests={false}
      showsBuildings={false}
      showsCompass={false}
      showsUserLocation={locationAllowed}
      showsMyLocationButton={false} // Android's built-in button; we draw our own
      // The map reports each new position; keep only the latest, in the ref.
      onUserLocationChange={(event) => {
        const c = event.nativeEvent.coordinate;
        if (c) userLocation.current = { latitude: c.latitude, longitude: c.longitude };
      }}
      initialRegion={CAMPUS_REGION}
      // Fires when the user finishes a drag or pinch: switch between pins and dots.
      onRegionChangeComplete={(region) => setZoomedOut(region.latitudeDelta > DOT_ZOOM_DELTA)}
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
        const press = lastPress.current;
        const recentPress = press !== null && Date.now() - press.at < TAP_WINS_MS;
        // Zoomed out, Apple Maps sometimes selects a nearby marker right after the tapped one,
        // with no tap behind it. A tap wins for a moment: ignore a different room selected just after.
        if (recentPress && press.roomId !== room.id) {
          // Deselect it too, or Apple Maps keeps it selected and ignores the next real tap on it.
          markerRefs.current[room.id]?.hideCallout();
          return;
        }
        // The tap that just happened already opened this room (and a re-open would reset the picker).
        // Compared with the tap, not selectedRoom: this select arrives ~2ms after the tap, before
        // React has re-rendered, so selectedRoom here is still the value from before the tap.
        if (recentPress && press.roomId === room.id) return;
        openPanel(room);
      }}
      // A custom view as the child replaces Apple's default balloon, which has a grow-on-select
      // animation (it visibly flashed when the TAP_WINS_MS guard deselected a stray marker).
      // The open room's marker swaps colours and draws on top of its neighbours.
      // A pin's point is its bottom centre; a dot's is its middle.
      anchor={zoomedOut ? { x: 0.5, y: 0.5 } : { x: 0.5, y: 1 }}
      zIndex={selectedRoom?.id === room.id ? OPEN_ROOM_Z_INDEX : restingZIndex[room.id]}>
        {zoomedOut
          ? <MarkerDot selected={selectedRoom?.id === room.id} />
          : <MarkerPin selected={selectedRoom?.id === room.id} />}
      </Marker>
    ))}
      </MapView>
      <PrayerCountdown />
      {!selectedRoom &&
      <View style={[styles.mapButtons, { bottom: tabBarHeight + 12 }]}>
        {/* Back to campus: the same view the map starts with. Always shown, even without location. */}
        <GlassView style={styles.mapButton} glassEffectStyle="regular" isInteractive>
          <Pressable style={styles.mapButtonPress} onPress={() => {
            // Same "fly" camera move as the location button. ~2200m altitude matches the starting zoom.
            mapRef.current?.animateCamera({
              center: { latitude: CAMPUS_REGION.latitude, longitude: CAMPUS_REGION.longitude },
              altitude: 2200, heading: 0, pitch: 0,
            });
            setZoomedOut(false); // the starting zoom shows pins, not dots
          }}>
            <CampusIcon size={24} />
          </Pressable>
        </GlassView>
        {locationAllowed &&
        <GlassView style={styles.mapButton} glassEffectStyle="regular" isInteractive>
          <Pressable style={styles.mapButtonPress} onPress={recenter}>
            <Ionicons name="navigate-outline" size={22} color={colors.grey} />
          </Pressable>
        </GlassView>}
      </View>}
      {selectedRoom &&
      <View style={[styles.panel, { paddingBottom: tabBarHeight + 16 }]}>
        <Pressable style={styles.closeButton} onPress={closePanel}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>

        <View style={styles.header}>
          <View style={styles.logo}>
            <MarkerPin selected={false} height={60} />
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

        {mode === "cancel" ?
        <View style={styles.actions}>
          <View style={styles.confirmTextBox}>
            <Text style={styles.confirmText}>Cancel your request?</Text>
            <Text style={styles.warningText}>
              You’re cancelling on {otherPerson(gender)}. Be considerate of others’ time.
            </Text>
          </View>
          <Pressable style={styles.confirmYes} disabled={busy} onPress={() => { setPanelMode("buttons"); cancelRequest(); }}>
            <Text style={styles.timeText}>Yes</Text>
          </Pressable>
          <Pressable style={styles.confirmNo} onPress={() => setPanelMode("buttons")}>
            <Text style={styles.confirmNoText}>No</Text>
          </Pressable>
        </View>
        : mode === "leave" ?
        <View style={styles.actions}>
          <View style={styles.confirmTextBox}>
            <Text style={styles.confirmText}>Leave this request?</Text>
            <Text style={styles.warningText}>
              Remember, {otherPerson(gender)} is expecting you.
            </Text>
          </View>
          <Pressable style={styles.confirmYes} disabled={busy} onPress={() => { setPanelMode("buttons"); leaveRequest(); }}>
            <Text style={styles.timeText}>Yes</Text>
          </Pressable>
          <Pressable style={styles.confirmNo} onPress={() => setPanelMode("buttons")}>
            <Text style={styles.confirmNoText}>No</Text>
          </Pressable>
        </View>
        : mode === "picker" ?
        <View style={styles.actions}>
          <Text style={styles.whenText}>When?</Text>
          {START_OFFSETS.map((minutes) => (
            <Pressable key={minutes} style={styles.timeButton} disabled={busy} onPress={() => { setPanelMode("buttons"); postRequest(selectedRoom.id, minutes); }}>
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
            <Ionicons name="location" size={24} color={colors.scarlet} />
          </Pressable>
          {/* Once a request is in progress, the prayer is happening: "Done" ends it with no warning.
              Done only hides it here; deleting would lose it from the tally. */}
          {activeRequestRow && isInProgress(activeRequestRow.start_time, now) ?
          <Pressable style={[styles.requestButton, styles.doneButton]} onPress={() => markDone(activeRequestRow.id)}>
            <Text style={styles.cancelTitle} numberOfLines={1}>Done</Text>
            <Text style={styles.cancelDetail} numberOfLines={1}>
              {myRequestRoom?.building} · {formatTime(activeRequestRow.start_time)}
            </Text>
          </Pressable>
          : activeRequestRow ?
          <Pressable
            style={[styles.requestButton, styles.cancelButton, busy && styles.busyButton]}
            disabled={busy}
            // Only warn when someone joined; with no joiners, cancelling affects nobody.
            onPress={() => ((counts[activeRequestRow.id] ?? 0) > 0 ? setPanelMode("cancel") : cancelRequest())}>
            <Text style={styles.cancelTitle} numberOfLines={1}>Cancel to start a new request</Text>
            <Text style={styles.cancelDetail} numberOfLines={1}>
              {myRequestRoom?.building} · {formatTime(activeRequestRow.start_time)}
            </Text>
          </Pressable>
          : activeJoinedRow && isInProgress(activeJoinedRow.start_time, now) ?
          <Pressable style={[styles.requestButton, styles.doneButton]} onPress={() => markDone(activeJoinedRow.id)}>
            <Text style={styles.cancelTitle} numberOfLines={1}>Done</Text>
            <Text style={styles.cancelDetail} numberOfLines={1}>
              {myJoinedRoom?.building} · {formatTime(activeJoinedRow.start_time)}
            </Text>
          </Pressable>
          : activeJoinedRow ?
          <Pressable style={[styles.requestButton, styles.cancelButton, busy && styles.busyButton]} disabled={busy} onPress={() => setPanelMode("leave")}>
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
          // Not offered until the first load is in (the user may already have a request that hasn't
          // arrived yet), nor while an action is on its way (a post shows the spinner here).
          <Pressable style={[styles.requestButton, (busy || !loaded) && styles.busyButton]}
            disabled={busy || !loaded} onPress={() => setPanelMode("picker")}>
            {busy || !loaded
              ? <ActivityIndicator color={colors.paper} />
              : <Text style={styles.requestText}>Request</Text>}
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

    backgroundColor: colors.paper,
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
    color: colors.grey,
  },
  mapButtons: {
    position: "absolute",
    right: 16,
    gap: 10,                // campus button stacked above the location button
  },
  mapButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
  },
  mapButtonPress: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",   // logo and name side by side
    alignItems: "center",
    marginTop: 8,
  },
  logo: {
    marginRight: 12,
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
    color: colors.grey,
  },
  requestsLink: {
    color: colors.scarlet,
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
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  requestButton: {
    flex: 1,                // stretch across the rest of the row
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  busyButton: {
    opacity: 0.6,           // dimmed while an action is on its way or data is still loading
  },
  requestText: {
    color: colors.paper,
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
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  timeText: {
    color: colors.paper,
    fontSize: 16,
    fontWeight: "bold",
  },
  timeUnit: {
    color: colors.paper,
    fontSize: 10,
    paddingHorizontal: 4,   // keeps the word off the rounded edges
  },
  pickerClose: {
    padding: 8,
  },
  cancelButton: {
    backgroundColor: colors.scarlet, // scarlet: you're in a request
    paddingHorizontal: 16,
  },
  doneButton: {
    backgroundColor: colors.success,   // green: the prayer is happening, nothing to warn about
    paddingHorizontal: 16,
  },
  finishingButton: {
    backgroundColor: colors.grey,   // grey: nothing to do but wait (dark enough for white text)
    paddingHorizontal: 16,
  },
  cancelTitle: {
    color: colors.paper,
    fontSize: 16,
    fontWeight: "bold",
  },
  cancelDetail: {
    color: colors.paper,
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
    color: colors.grey,
    marginTop: 2,
  },
  confirmYes: {
    height: 52,
    paddingHorizontal: 24,
    borderRadius: 26,
    backgroundColor: colors.scarlet,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  confirmNo: {
    height: 52,
    paddingHorizontal: 24,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmNoText: {
    fontSize: 16,
    fontWeight: "bold",
  },
});

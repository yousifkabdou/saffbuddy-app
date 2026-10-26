import { Location, Locations } from "@/data/location";
import { useState } from "react";
import { StyleSheet, View, Text, Pressable, Alert, Linking, Platform } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { useBottomTabBarHeight } from "expo-router/js-tabs";

// Opens walking directions to a room in the user's map app.
// iOS asks Apple Maps or Google Maps; Android goes straight to Google Maps.
function openDirections(room: Location) {
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
  const [selectedRoom, setSelectedRoom] = useState<null | Location>(null);
  const tabBarHeight = useBottomTabBarHeight(); // the tab bar floats over the screen, so the panel needs room for it
  return (

    <View style={styles.container}>
      <MapView style={styles.map}
      initialRegion={{
        latitude: 40.000632,
        longitude: -83.013325,
        latitudeDelta: 0.013,
        longitudeDelta: 0.013,
      }}>
      {Locations.map((room) => (
      <Marker key = {room.id} coordinate =
      {{latitude: room.latitude, longitude: room.longitude }}
      onPress={ () => setSelectedRoom(room)}/>
    ))}
      </MapView>
      {selectedRoom &&
      <View style={[styles.panel, { paddingBottom: tabBarHeight }]}>
        <Pressable style={styles.closeButton} onPress={() => setSelectedRoom(null)}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>

        <View style={styles.header}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>🕌</Text>
          </View>
          <Text style={styles.name}>{selectedRoom.name}</Text>
        </View>

        <Text style={styles.description}>
          { `${selectedRoom.floor}, Room ${selectedRoom.roomNum}`}
        </Text>

        <View style={styles.actions}>
          <Pressable style={styles.directionsButton} onPress={() => openDirections(selectedRoom)}>
            <Text style={styles.directionsText}>➤</Text>
          </Pressable>
          <Pressable style={styles.requestButton} onPress={() => Alert.alert("Coming soon", "Prayer buddy requests aren't built yet.")}>
            <Text style={styles.requestText}>Request</Text>
          </Pressable>
        </View>
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
  description: {
    color: "gray",
    marginTop: 16,
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
});

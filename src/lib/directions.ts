import { Room } from "@/data/room";
import { Alert, Linking, Platform } from "react-native";

// Opens walking directions to a room in the user's map app.
// iOS asks Apple Maps or Google Maps; Android goes straight to Google Maps.
// The app never sends the user's location anywhere: the map app works out the route (docs/adr/0002).
export function openDirections(room: Room) {
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

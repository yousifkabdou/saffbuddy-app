import { Location, Locations } from "@/data/location";
import { useState } from "react";
import { StyleSheet, View, Text } from "react-native";
import MapView, { Marker } from "react-native-maps";




export default function Index() {
  const [selectedRoom, setSelectedRoom] = useState<null | Location>(null);
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
      <View style={styles.panel}>
      <Text>Hi</Text>
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
    top: 430,
    

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
  }
});

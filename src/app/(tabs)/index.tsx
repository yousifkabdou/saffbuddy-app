import { StyleSheet, View } from "react-native";
import MapView  from "react-native-maps";
import {Marker}  from "react-native-maps";
import {Locations} from "@/data/location";




export default function Index() {
  
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
      title = {room.name} 
      description = {`Floor: ${room.floor}. Room Number: ${room.roomNum}`}/>
    ))}
    
      </MapView>
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
  }
});

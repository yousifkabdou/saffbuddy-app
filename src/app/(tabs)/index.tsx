import { StyleSheet, View } from "react-native";
import MapView from "react-native-maps";



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

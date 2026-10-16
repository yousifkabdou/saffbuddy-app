import { Locations } from "@/data/location";
import { FlatList, StyleSheet, Text, View } from "react-native";

export default function Index() {
  return (
    <View style={styles.container}>
      <FlatList
        data = {Locations}
        renderItem = { ({item}) => <Text>{item.name} - Room: {item.roomNum}
         {item.gender &&  ` - (${item.gender})`}</Text> }
        />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

import { Locations } from "@/data/location";
import { FlatList, StyleSheet, Text, View } from "react-native";
import {Link} from "expo-router"

export default function Index() {
  return (
    <View style={styles.container}>
      <FlatList
        data = {Locations}
        renderItem = { ({item}) => <Text>{item.name} - Room: {item.roomNum}
         {item.gender &&  ` - (${item.gender})`}</Text> }
        />
        <Link href="/login">Go to login</Link>
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

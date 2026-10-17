import { Link } from "expo-router";
import { StyleSheet, View } from "react-native";


export default function Index() {
  
  return (
    <View style={styles.container}>
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

import { StyleSheet, Text, View } from "react-native";

export default function Times() {
  return (
    <View style={styles.container}>
      <Text>Times.</Text>
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

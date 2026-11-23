import { colors } from "@/theme";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/AppText";

type Props = {
  message: string;     // what failed, e.g. "Couldn't load your profile"
  onRetry: () => void;
  retrying: boolean;   // true while the retry is running: shows a spinner and ignores extra taps
};

// Full-screen "something failed to load" state with a retry button.
// Used before the tabs exist (so the StatusOverlay banner isn't available yet).
export default function LoadFailedScreen({ message, onRetry, retrying }: Props) {
  return (
    <View style={styles.screen}>
      <Ionicons name="cloud-offline-outline" size={40} color={colors.grey} />
      <Text style={styles.message}>{message}</Text>
      <Text style={styles.hint}>Check your connection and try again</Text>
      <Pressable style={[styles.button, retrying && styles.buttonDisabled]} onPress={onRetry} disabled={retrying}>
        {retrying
          ? <ActivityIndicator size="small" color={colors.paper} />
          : <Text style={styles.buttonText}>Try again</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 32,
    backgroundColor: colors.paper,
  },
  message: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
    textAlign: "center",
  },
  hint: {
    fontSize: 15,
    color: colors.grey,
    textAlign: "center",
  },
  button: {
    marginTop: 8,
    minWidth: 140,
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: colors.scarlet,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.paper,
    fontSize: 16,
    fontWeight: "700",
  },
});

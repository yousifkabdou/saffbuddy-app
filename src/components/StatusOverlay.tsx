import { useSharedRequests } from "@/context/RequestsContext";
import { colors } from "@/theme";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/AppText";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Floats over every tab, below the status bar:
// - the retry banner while any load has failed (stays until a load succeeds)
// - the toast when an action failed, or the blessing after Done (hides itself after a few seconds; tap to dismiss)
// It's rendered once in the tabs layout, so it shows the same thing whichever tab is open.
export default function StatusOverlay() {
  const { toast, hideToast, loadFailed, retryLoads, retrying } = useSharedRequests();
  const insets = useSafeAreaInsets();

  if (!toast && !loadFailed) return null;

  return (
    // box-none: this container ignores touches, so the screen below stays usable; only the bars catch taps.
    <View style={[styles.overlay, { top: insets.top + 8 }]} pointerEvents="box-none">
      {loadFailed &&
      <Pressable style={[styles.bar, styles.banner]} onPress={retryLoads} disabled={retrying}>
        {retrying
          ? <ActivityIndicator size="small" color={colors.paper} />
          : <Ionicons name="cloud-offline-outline" size={18} color={colors.paper} />}
        <Text style={styles.text}>{retrying ? "Retrying…" : "Couldn't load requests · Tap to retry"}</Text>
      </Pressable>}

      {toast &&
      <Pressable style={[styles.bar, toast.kind === "success" ? styles.success : styles.toast]} onPress={hideToast}>
        <Ionicons name={toast.kind === "success" ? "heart-outline" : "alert-circle-outline"} size={18} color={colors.paper} />
        <Text style={styles.text}>{toast.message}</Text>
      </Pressable>}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 16,
    right: 16,
    gap: 8,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,

    shadowColor: "black",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 8,
  },
  banner: {
    backgroundColor: colors.charcoal,   // dark grey: something's off, but nothing the user did
  },
  toast: {
    backgroundColor: colors.scarlet, // scarlet: an action failed
  },
  success: {
    backgroundColor: colors.success, // green: a kind word after Done
  },
  text: {
    flex: 1,                      // wrap long messages instead of running off the edge
    color: colors.paper,
    fontWeight: "600",
  },
});

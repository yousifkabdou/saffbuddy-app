import { colors } from "@/theme";
import { GlassView } from "expo-glass-effect";
import { StyleSheet, View } from "react-native";
import { Text } from "@/components/AppText";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Height of the floating title, so screens can start their content below it.
export const TITLE_HEIGHT = 56;

// Floating liquid glass title at the top of a tab ("Requests", "Prayer Times").
// Content scrolls underneath it; use titleSpace() for the top padding.
export default function TitlePill({ title }: { title: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrapper, { top: insets.top + 8 }]} pointerEvents="none">
      <GlassView style={styles.pill} glassEffectStyle="regular">
        <Text style={styles.text} accessibilityRole="header">{title}</Text>
      </GlassView>
    </View>
  );
}

// Top padding a screen needs so its content starts below the pill.
export function useTitleSpace() {
  const insets = useSafeAreaInsets();
  return insets.top + TITLE_HEIGHT + 8;
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  pill: {
    height: TITLE_HEIGHT,
    paddingHorizontal: 28,
    borderRadius: TITLE_HEIGHT / 2,
    justifyContent: "center",
    overflow: "hidden",
  },
  text: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.ink,
  },
});

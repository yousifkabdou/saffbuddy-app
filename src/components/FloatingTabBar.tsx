import { colors } from "@/theme";
import Ionicons from "@expo/vector-icons/Ionicons";
import { GlassView } from "expo-glass-effect";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { Pressable, StyleSheet, View } from "react-native";

// Icon for each tab, by route name (the file name in (tabs)/). Outline when not open, filled when open.
type TabIcon = { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap };
const ICONS: Record<"index" | "requests" | "times", TabIcon> = {
  index: { on: "home", off: "home-outline" },
  requests: { on: "people", off: "people-outline" },
  times: { on: "time", off: "time-outline" },
};
// Expo Router makes every file in (tabs)/ a tab, listed here or not; this keeps a new one from crashing.
const FALLBACK_ICON: TabIcon = { on: "ellipse", off: "ellipse-outline" };
// What a screen reader says for each tab.
const LABELS: Record<string, string> = { index: "Home", requests: "Requests", times: "Prayer Times" };

// Replaces the default tab bar (passed to <Tabs tabBar={...}>). The navigator gives us its state:
// which tabs exist and which is open; we draw the buttons and call navigateToTab on press.
// GlassView is Apple's liquid glass on iOS 26+, and a plain view elsewhere.
export default function FloatingTabBar({ state, navigateToTab, insets }: BottomTabBarProps) {
  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom }]} pointerEvents="box-none">
      <GlassView style={styles.pill} glassEffectStyle="regular" isInteractive>
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const icon = ICONS[route.name as keyof typeof ICONS] ?? FALLBACK_ICON;
          return (
            <Pressable
              key={route.key}
              onPress={() => navigateToTab(route.key)}
              accessibilityRole="tab"
              accessibilityLabel={LABELS[route.name] ?? route.name}
              accessibilityState={{ selected: focused }}
              style={[styles.tab, focused && styles.tabFocused]}
            >
              <Ionicons name={focused ? icon.on : icon.off} size={24} color={focused ? colors.scarlet : colors.grey} />
            </Pressable>
          );
        })}
      </GlassView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",  // float over the screen so the map shows behind it
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",  // pill is only as wide as its icons, centred
  },
  pill: {
    flexDirection: "row",
    gap: 4,                // icons sit close together
    padding: 6,
    borderRadius: 32,
    overflow: "hidden",
  },
  tab: {
    width: 64,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  tabFocused: {
    backgroundColor: "rgba(187, 0, 0, 0.1)", // soft scarlet bubble behind the open tab
  },
});

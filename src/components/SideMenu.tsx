import { useSharedRequests } from "@/context/RequestsContext";
import { supabase } from "@/lib/supabase";
import { colors } from "@/theme";
import Ionicons from "@expo/vector-icons/Ionicons";
import { GlassView } from "expo-glass-effect";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { Animated, BackHandler, Dimensions, Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/AppText";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MENU_WIDTH = Math.min(300, Dimensions.get("window").width * 0.8);

// The privacy policy, as published from docs/privacy-policy.md. Update this if it moves
// (for example to a GitHub Pages site); the App Store Connect listing needs the same URL.
const PRIVACY_POLICY_URL = "https://github.com/yousifkabdou/saffbuddy-app/blob/main/docs/privacy-policy.md";

// Menu button (top left, on every tab) + the side menu it opens: Profile at the top, Sign Out at the bottom.
// Rendered once in the tabs layout, above the screens.
export default function SideMenu() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { showToast } = useSharedRequests();
  // 0 = closed (menu off-screen to the left), 1 = open. Animated so it slides instead of popping in.
  // Held in state (created once by the initializer, never set again) rather than a ref, because render
  // reads it; reading ref.current during render breaks the React Compiler's assumptions.
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(progress, { toValue: open ? 1 : 0, duration: 220, useNativeDriver: true }).start();
  }, [open, progress]);

  // Android: while the menu is open, the back button closes it (the usual drawer behaviour)
  // instead of leaving the screen. Returning true tells Android the press was handled.
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setOpen(false);
      return true;
    });
    return () => sub.remove();
  }, [open]);

  const handleSignOut = async () => {
    // local: sign out of this phone only; other devices stay signed in (matches Profile's sign-out).
    const {error} = await supabase.auth.signOut({ scope: "local" });

    if (error){
      console.log(error.message);
      // Offline with an expired token, auth-js can't load the session and keeps it, so the user
      // is still signed in. Say so instead of silently doing nothing.
      setOpen(false);
      showToast("Couldn't sign out. Check your connection and try again.");
    }
    // No navigation on success: the tabs layout's onAuthStateChange sees the session end and redirects to login.
  };

  const openPrivacyPolicy = () => {
    setOpen(false);
    // Opens in an in-app browser sheet, so the user stays in SaffBuddy.
    WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL).catch((e) => {
      console.log("couldn't open the privacy policy", e);
      showToast("Couldn't open the privacy policy. Try again.");
    });
  };

  const goToProfile = () => {
    setOpen(false);
    router.push("/profile");
  };

  return (
    <>
      <GlassView style={[styles.menuButton, { top: insets.top + 12 }]} glassEffectStyle="regular" isInteractive>
        <Pressable style={styles.menuPress} onPress={() => setOpen(true)}
          accessibilityRole="button" accessibilityLabel="Open menu">
          <Ionicons name="menu" size={22} color={colors.ink} />
        </Pressable>
      </GlassView>

      {/* pointerEvents: while closed, the invisible overlay must not block taps on the screen below. */}
      {/* While closed, also hide it from screen readers: being off-screen doesn't, so VoiceOver
          could still reach "Sign Out". (accessibilityElementsHidden: iOS; importantForAccessibility: Android.) */}
      <View style={StyleSheet.absoluteFill} pointerEvents={open ? "auto" : "none"}
        accessibilityElementsHidden={!open} importantForAccessibility={open ? "auto" : "no-hide-descendants"}>
        {/* Dimmed backdrop; tapping it closes the menu. */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)}
            accessibilityRole="button" accessibilityLabel="Close menu" />
        </Animated.View>

        <Animated.View
          style={[
            styles.menu,
            { width: MENU_WIDTH, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
            { transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-MENU_WIDTH, 0] }) }] },
          ]}
        >
          <Text style={styles.appName}>SaffBuddy</Text>

          <Pressable style={styles.item} onPress={goToProfile} accessibilityRole="button">
            <Ionicons name="person-circle-outline" size={24} color={colors.ink} />
            <Text style={styles.itemText}>Profile</Text>
          </Pressable>

          <Pressable style={styles.item} onPress={openPrivacyPolicy} accessibilityRole="link">
            <Ionicons name="shield-checkmark-outline" size={24} color={colors.ink} />
            <Text style={styles.itemText}>Privacy Policy</Text>
          </Pressable>

          {/* Pushed to the bottom by marginTop: "auto". */}
          <Pressable style={[styles.item, styles.signOut]} onPress={handleSignOut} accessibilityRole="button">
            <Ionicons name="log-out-outline" size={24} color={colors.scarlet} />
            <Text style={[styles.itemText, styles.signOutText]}>Sign Out</Text>
          </Pressable>
        </Animated.View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  menuButton: {
    position: "absolute",
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
  },
  menuPress: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  backdrop: {
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  menu: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.paper,
    paddingHorizontal: 20,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
  },
  appName: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.scarlet,
    marginBottom: 24,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  itemText: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.ink,
  },
  signOut: {
    marginTop: "auto",
  },
  signOutText: {
    color: colors.scarlet,
  },
});

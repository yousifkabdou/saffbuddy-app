import { fontFiles } from "@/fonts";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  // Load the app font before showing anything, so text doesn't flash in the system font first.
  // If loading fails (fontError), carry on: text falls back to the system font at regular
  // weight (AppText swaps fontWeight for a font family, which wouldn't exist).
  const [fontsLoaded, fontError] = useFonts(fontFiles);
  if (fontError) console.warn("fonts failed to load", fontError);
  if (!fontsLoaded && !fontError) return null;

  // The app is light-only for v1 (app.json userInterfaceStyle "light"), so the status bar text
  // is always dark. On a dark-mode phone it would otherwise turn white over white screens.
  return <>
    <StatusBar style="dark" />
    <Stack screenOptions={{ headerShown: false }} />
  </>
}

import { fontFiles } from "@/fonts";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";

export default function RootLayout() {
  // Load the app font before showing anything, so text doesn't flash in the system font first.
  // If loading fails (fontError), carry on: text falls back to the system font.
  const [fontsLoaded, fontError] = useFonts(fontFiles);
  if (!fontsLoaded && !fontError) return null;

  return <Stack screenOptions={{ headerShown: false }} />
}

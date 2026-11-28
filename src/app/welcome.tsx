import { Text } from "@/components/AppText";
import MarkerPin from "@/components/MarkerPin";
import { PRIVACY_NOTE, WELCOME_STEPS } from "@/lib/welcome";
import { colors } from "@/theme";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Shown once, right after a new user saves their profile (setup goes here only when it just
// created the profile; see src/lib/setupOutcome.ts). Nothing is saved to remember it was seen:
// no other screen links here, so it can't come back.
export default function Welcome() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 32 }]}>
        <View style={styles.logo}>
          <MarkerPin selected={false} height={40} color={colors.paper} iconColor={colors.scarlet} />
        </View>
        <Text style={styles.title} accessibilityRole="header">Welcome to SaffBuddy</Text>
        <Text style={styles.subtitle}>Find people on campus to pray in congregation with.</Text>

        {WELCOME_STEPS.map((step, i) => (
          <View key={step.title} style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{i + 1}</Text>
            </View>
            <View style={styles.stepText}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepBody}>{step.body}</Text>
            </View>
          </View>
        ))}

        <View style={styles.privacy}>
          <Ionicons name="shield-checkmark-outline" size={22} color={colors.scarlet} />
          <View style={styles.stepText}>
            <Text style={styles.stepTitle}>{PRIVACY_NOTE.title}</Text>
            <Text style={styles.stepBody}>{PRIVACY_NOTE.body}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Outside the ScrollView so it's always on screen, even on small phones. */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        {/* replace, not push: Back shouldn't return here (or to setup) from the map. */}
        <Pressable style={styles.button} onPress={() => router.replace("/")} accessibilityRole="button">
          <Text style={styles.buttonText}>Get started</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: "center",
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.scarlet,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.ink,
    marginTop: 16,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: colors.grey,
    marginTop: 6,
    marginBottom: 28,
    textAlign: "center",
  },
  step: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    width: "100%",
    maxWidth: 440,
    marginBottom: 20,
  },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.scarlet,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: {
    color: colors.paper,
    fontSize: 15,
    fontWeight: "700",
  },
  stepText: {
    flex: 1,                // wrap the text instead of running off the screen
  },
  stepTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.ink,
  },
  stepBody: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.grey,
    marginTop: 2,
  },
  privacy: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    width: "100%",
    maxWidth: 440,
    marginTop: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.paper,
  },
  button: {
    height: 50,
    borderRadius: 25,       // half the height = pill, matching the setup screen's Save
    backgroundColor: colors.scarlet,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: colors.paper,
    fontSize: 16,
    fontWeight: "600",
  },
});

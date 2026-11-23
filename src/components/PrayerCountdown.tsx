import { formatCampusTime } from "@/lib/campusTime";
import { formatCountdown, nextPrayer } from "@/lib/prayerTimes";
import { colors } from "@/theme";
import { GlassView } from "expo-glass-effect";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "@/components/AppText";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Floating card at the top of the map: "Asr is in:", the countdown, then the start time.
export default function PrayerCountdown() {
  const insets = useSafeAreaInsets();
  // The only state is the current time. Everything shown is derived from it on each render,
  // so when the countdown hits zero, the next tick simply picks the next prayer.
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000); // re-render once a second
    return () => clearInterval(timer); // stop ticking when the map screen unmounts
  }, []);

  const prayer = nextPrayer(now);
  const startTime = formatCampusTime(prayer.time);

  return (
    <View style={[styles.wrapper, { top: insets.top + 8 }]} pointerEvents="none">
      <GlassView style={styles.card} glassEffectStyle="regular">
        <Text style={styles.title}>{prayer.name} is in:</Text>
        <Text style={styles.countdown}>{formatCountdown(prayer.time.getTime() - now.getTime())}</Text>
        <Text style={styles.time}>({startTime})</Text>
      </GlassView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center", // card is only as wide as its text, centred
  },
  card: {
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 24,
    alignItems: "center",
    overflow: "hidden",
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.ink,
  },
  countdown: {
    fontSize: 30,
    fontWeight: "700",
    color: colors.scarlet,
    fontVariant: ["tabular-nums"], // fixed-width digits so the text doesn't wobble every second
  },
  time: {
    fontSize: 13,
    color: colors.grey, // smaller and softer than the countdown
  },
});

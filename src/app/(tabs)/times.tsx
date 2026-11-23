import TitlePill, { useTitleSpace } from "@/components/TitlePill";
import { dailyTimes, nextPrayer } from "@/lib/prayerTimes";
import { colors } from "@/theme";
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Text } from "@/components/AppText";

// Today's prayer times (calculated on the phone, see src/lib/prayerTimes.ts), next prayer highlighted.
export default function Times() {
  const top = useTitleSpace();
  const tabBarHeight = useBottomTabBarHeight();
  // The clock, refreshed every 30s: moves the highlight when a prayer starts,
  // and rolls the timetable over to the new day after midnight.
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30 * 1000);
    return () => clearInterval(timer);
  }, []);

  const times = dailyTimes(now);
  const next = nextPrayer(now); // after Isha this is tomorrow's Fajr, so nothing today is highlighted
  const dateLabel = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: top, paddingBottom: tabBarHeight + 16 }}>
        <Text style={styles.date}>{dateLabel}</Text>

        <View style={styles.card}>
          {times.map((t, i) => {
            const isNext = t.time.getTime() === next.time.getTime();
            return (
              <View key={t.name} style={[styles.row, i > 0 && styles.rowDivider]}>
                <Text style={[styles.name, isNext && styles.next]}>{t.name}</Text>
                {isNext && <Text style={styles.nextTag}>Next</Text>}
                <Text style={[styles.time, isNext && styles.next]}>
                  {t.time.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.note}>Calculated for OSU campus (ISNA, standard Asr)</Text>

      </ScrollView>
      <TitlePill title="Prayer Times" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  date: {
    textAlign: "center",
    color: colors.grey,
    fontSize: 15,
    marginTop: 4,
    marginBottom: 12,
  },
  card: {
    flex: 1,                // stretch to fill the height left between the date and the note
    backgroundColor: colors.paper,
    borderRadius: 20,
    marginHorizontal: 16,
    paddingHorizontal: 20,
    shadowColor: "black",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  row: {
    flex: 1,                // the six rows share the card's height equally
    flexDirection: "row",   // name on the left, time on the right
    alignItems: "center",
    paddingVertical: 16,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  name: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.scarlet,
  },
  time: {
    marginLeft: "auto",     // push the time to the right edge
    fontSize: 18,
    color: colors.scarlet,
    fontVariant: ["tabular-nums"],
  },
  next: {
    fontWeight: "800",      // all rows are scarlet; the next one stands out by weight and its tag
  },
  nextTag: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: colors.scarlet,
    color: colors.paper,
    fontSize: 12,
    fontWeight: "700",
  },
  note: {
    textAlign: "center",
    color: colors.grey,
    fontSize: 12,
    marginTop: 12,
  },
});

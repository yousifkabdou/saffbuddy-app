import TitlePill, { useTitleSpace } from "@/components/TitlePill";
import { supabase } from "@/lib/supabase";
import { colors } from "@/theme";
import Ionicons from "@expo/vector-icons/Ionicons";
import { GlassView } from "expo-glass-effect";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "@/components/AppText";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Profile = { first_name: string; gender: "Men" | "Women" };

// The signed-in user's profile, opened from the side menu. Read-only: first name and gender
// can't be changed after setup (the profiles table has no update grant).
export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const top = useTitleSpace();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [failed, setFailed] = useState(false);

  // Load once on open. RLS only returns the user's own row; .eq makes that explicit.
  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) return;
      setEmail(user.email ?? "");
      const { data, error } = await supabase.from("profiles").select("first_name, gender").eq("id", user.id).maybeSingle();
      if (error || !data) {
        console.log(error?.message ?? "no profile row");
        setFailed(true);
        return;
      }
      setProfile(data);
    };
    load();
  }, []);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingTop: top + 24, paddingBottom: insets.bottom + 24 }}>
        {failed ? <Text style={styles.message}>Couldn’t load your profile. Go back and try again</Text>
        : !profile ? <ActivityIndicator style={styles.spinner} color={colors.grey} />
        : <View style={styles.card}>
            <Row label="First name" value={profile.first_name} />
            <Row label="Gender" value={profile.gender === "Men" ? "Brother" : "Sister"} divider />
            <Row label="Email" value={email} divider />
          </View>}
        <Text style={styles.note}>Name and gender can’t be changed after setup</Text>

        {/* Placeholder: not designed or wired up yet. */}
        <Text style={styles.reportText}>Report a problem</Text>
        <Text style={styles.note}>Coming soon</Text>

        {/* Placeholder: not wired up yet. Design approved 2026-11-21 (security definer
            delete_my_account(), confirm dialog, then sign out); implemented in its own change. */}
        <Text style={styles.deleteText}>Delete account</Text>
        <Text style={styles.note}>Coming soon</Text>
      </ScrollView>

      <TitlePill title="Profile" />
      {/* Back to the tabs (this screen is pushed on top of them). */}
      <GlassView style={[styles.backButton, { top: insets.top + 12 }]} glassEffectStyle="regular" isInteractive>
        <Pressable style={styles.backPress} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
      </GlassView>
    </View>
  );
}

function Row({ label, value, divider }: { label: string; value: string; divider?: boolean }) {
  return (
    <View style={[styles.row, divider && styles.rowDivider]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  spinner: {
    marginTop: 24,
  },
  card: {
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
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    gap: 12,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  label: {
    fontSize: 16,
    color: colors.grey,
  },
  value: {
    flex: 1,
    textAlign: "right",
    fontSize: 16,
    fontWeight: "600",
    color: colors.ink,
  },
  note: {
    textAlign: "center",
    color: colors.grey,
    fontSize: 12,
    marginTop: 12,
  },
  reportText: {
    textAlign: "center",
    color: colors.ink,
    fontSize: 16,
    fontWeight: "600",
    marginTop: 32,
    opacity: 0.5,           // faded: it doesn't do anything yet
  },
  deleteText: {
    textAlign: "center",
    color: colors.scarlet,
    fontSize: 16,
    fontWeight: "600",
    marginTop: 32,
    opacity: 0.5,           // faded: it doesn't do anything yet
  },
  message: {
    textAlign: "center",
    color: colors.grey,
    marginTop: 24,
    marginHorizontal: 24,
  },
  backButton: {
    position: "absolute",
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
  },
  backPress: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

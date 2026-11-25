import TitlePill, { useTitleSpace } from "@/components/TitlePill";
import { supabase } from "@/lib/supabase";
import { colors } from "@/theme";
import Ionicons from "@expo/vector-icons/Ionicons";
import { GlassView } from "expo-glass-effect";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { isNetworkError } from "@/lib/errors";
import { isOffline, OFFLINE_ERROR } from "@/lib/network";
import { openSupportEmail, SUPPORT_EMAIL } from "@/lib/support";
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
  const [deleting, setDeleting] = useState(false);

  // Load once on open. RLS only returns the user's own row; .eq makes that explicit.
  useEffect(() => {
    const load = async () => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (sessionError || !user) {
        // Without this the spinner never stopped (e.g. offline with an expired token).
        console.log(sessionError?.message ?? "no session");
        setFailed(true);
        return;
      }
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

  const confirmDelete = () => {
    Alert.alert(
      "Delete your account?",
      "This permanently deletes your account and any request you’re in. It can’t be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: deleteAccount },
      ],
    );
  };

  const deleteAccount = async () => {
    setDeleting(true);
    // delete_my_account() (supabase/delete_account.sql) deletes the caller's auth user; the
    // database's cascades remove their profile, request and joins. It takes no arguments:
    // the server reads who's asking from the login token.
    const { error } = (await isOffline()) ? { error: OFFLINE_ERROR } : await supabase.rpc("delete_my_account");
    if (error) {
      console.log(error.message);
      setDeleting(false);
      Alert.alert(
        "Couldn’t delete your account",
        isNetworkError(error) ? "No connection. Check your internet and try again." : "Something went wrong. Try again.",
      );
      return;
    }
    // Navigate first, then sign out. This screen sits on top of the tabs: closing both unmounts the
    // tabs layout and its auth listener, so only this code navigates. (Signing out first made the
    // layout redirect to login too, which could stack two login screens.)
    router.dismissAll();
    router.replace("/login");
    // Clears the login saved on this phone. scope "local" still calls the server's logout, which
    // fails now that the user is gone; signOut ignores that failure and clears the phone anyway.
    await supabase.auth.signOut({ scope: "local" });
  };

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

        <Pressable style={styles.textButton} onPress={openSupportEmail}>
          <Text style={styles.reportText}>Report a problem</Text>
        </Pressable>
        <Text style={styles.note}>Opens your mail app to email {SUPPORT_EMAIL}</Text>

        <Pressable style={styles.textButton} onPress={confirmDelete} disabled={deleting}>
          {deleting
            ? <ActivityIndicator color={colors.scarlet} />
            : <Text style={styles.deleteText}>Delete account</Text>}
        </Pressable>
        <Text style={styles.note}>Permanently deletes your account and any request you’re in</Text>
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
    color: colors.scarlet,
    fontSize: 16,
    fontWeight: "600",
  },
  // Shared by Report a problem and Delete account.
  textButton: {
    alignSelf: "center",
    marginTop: 32,
    paddingVertical: 8,     // bigger tap target than the text alone
    paddingHorizontal: 16,
    minHeight: 36,
    justifyContent: "center",
  },
  deleteText: {
    textAlign: "center",
    color: colors.scarlet,
    fontSize: 16,
    fontWeight: "600",
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

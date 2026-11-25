import { supabase } from "@/lib/supabase";
import { colors } from "@/theme";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import MarkerPin from "@/components/MarkerPin";
import { ActivityIndicator, KeyboardAvoidingView, Pressable, StyleSheet, View } from "react-native";
import { Text, TextInput } from "@/components/AppText";
import {
  isOsuEmail, isReviewEmail, isSixDigitCode, OSU_ONLY, passwordErrorMessage, RESEND_COOLDOWN_SECONDS,
  secondsToWait, sendCodeErrorMessage, verifyCodeErrorMessage,
} from "@/lib/authErrors";
import { isOffline, OFFLINE_ERROR } from "@/lib/network";

export default function Login(){
    const [email, setEmail] = useState(""); // what's typed in the email box
    // The address the code was actually sent to, or null before a code is sent.
    // Kept separate from `email` so Verify, Resend and the footer always use the address
    // the code went to. While it's set, the email is locked; "Change" clears it.
    const [sentTo, setSentTo] = useState<string | null>(null);
    const [code, setCode] = useState("");
    const [emailError, setEmailError] = useState("");
    const [verifyError, setVerifyError] = useState("");
    // True while a request is in flight: the button is disabled, so a double tap can't send
    // two codes (the second would replace the first one in the user's inbox).
    const [sending, setSending] = useState(false);
    const [verifying, setVerifying] = useState(false);
    // App Review only: the review address signs in with a password instead of a code.
    // passwordFor locks the email like sentTo does; no code is ever sent to that address.
    const [passwordFor, setPasswordFor] = useState<string | null>(null);
    const [password, setPassword] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [signingIn, setSigningIn] = useState(false);
    const lockedEmail = sentTo ?? passwordFor;

    // Resend cooldown. Supabase allows one code per address per 60s, so instead of letting the
    // user tap and get an error, the button counts down. cooldownUntil is a timestamp (ms);
    // `now` ticks every second only while a cooldown is running, to redraw the countdown.
    const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
      if (cooldownUntil === null) return;
      const timer = setInterval(() => {
        const t = Date.now();
        setNow(t);
        if (t >= cooldownUntil) setCooldownUntil(null); // done: stops this interval via cleanup
      }, 1000);
      return () => clearInterval(timer);
    }, [cooldownUntil]);
    const secondsLeft = cooldownUntil === null ? 0 : Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

    const startCooldown = (seconds: number) => {
      const t = Date.now();
      setNow(t);
      setCooldownUntil(t + seconds * 1000);
    };

    // First send uses the typed email (trimmed: autocomplete can add a trailing space).
    // Resend uses the locked address.
    const handleSendCode = async () => {
    if (sending || secondsLeft > 0) return;
    const address = sentTo ?? email.trim();
    if (!sentTo && isReviewEmail(address)) {
      setEmailError("");
      setPasswordFor(address); // show the password step instead of sending a code
      return;
    }
    if (!sentTo && !isOsuEmail(address)) {
      setEmailError(OSU_ONLY);
      return;
    }
    setSending(true);
    setEmailError("");
    // Offline check first: it answers instantly, while a fetch with no connection takes seconds to fail.
    const {error} = (await isOffline()) ? { error: OFFLINE_ERROR } : await supabase.auth.signInWithOtp({email: address});
    setSending(false);
    if (error){
      console.log(error.message);
      setEmailError(sendCodeErrorMessage(error));
      const wait = secondsToWait(error.message);
      if (wait) startCooldown(wait); // the server says how long; show it on the button too
      return
    }
    setSentTo(address);
    startCooldown(RESEND_COOLDOWN_SECONDS);
}

// Back to step one: unlock the email (keeping what was typed, to fix a typo) and drop the code step.
// The cooldown is per address, so a different email can get a code straight away.
const handleChangeEmail = () => {
  setSentTo(null);
  setCode("");
  setVerifyError("");
  setEmailError("");
  setCooldownUntil(null);
  setPasswordFor(null);
  setPassword("");
  setPasswordError("");
}

const handlePasswordSignIn = async () => {
  if (!passwordFor || signingIn) return;
  if (!password) {
    setPasswordError("Enter the password.");
    return;
  }
  setSigningIn(true);
  setPasswordError("");
  const {error} = (await isOffline())
    ? { error: OFFLINE_ERROR }
    : await supabase.auth.signInWithPassword({email: passwordFor, password});
  if (error){
    console.log(error.message);
    setSigningIn(false);
    setPasswordError(passwordErrorMessage(error));
    return
  }
  router.replace("/"); // leaving the screen, so `signingIn` stays true (no double sign-in)
}

const handleVerify = async() => {
  if (!sentTo || verifying) return;
  const token = code.trim(); // pasted codes can carry spaces
  if (!isSixDigitCode(token)) {
    setVerifyError("Enter the 6-digit code from the email.");
    return;
  }
  setVerifying(true);
  setVerifyError("");
  const {error} = (await isOffline()) ? { error: OFFLINE_ERROR } : await supabase.auth.verifyOtp({email: sentTo, token, type:"email"});
  if (error){
    console.log(error.message);
    setVerifying(false);
    setVerifyError(verifyCodeErrorMessage(error));
    return
  }
  router.replace("/"); // leaving the screen, so `verifying` stays true (no double verify)
}

    const sendLabel = sentTo ? "Resend code" : "Continue";

    return (
    // KeyboardAvoidingView: pushes the card up when the keyboard opens so the button stays visible.
    <KeyboardAvoidingView style={styles.container} behavior="padding">
        {/* App logo: white mosque pin on a scarlet tile. */}
        <View style={styles.logo}>
          <MarkerPin selected={false} height={40} color={colors.paper} iconColor={colors.scarlet} />
        </View>
        <Text style={styles.title}>Sign in to SaffBuddy</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          {lockedEmail
            ? <View style={[styles.input, styles.lockedRow]}>
                <Text style={styles.lockedEmail} numberOfLines={1}>{lockedEmail}</Text>
                <Pressable onPress={handleChangeEmail} hitSlop={8} disabled={sending || signingIn}>
                  <Text style={styles.changeText}>Change</Text>
                </Pressable>
              </View>
            : <TextInput style={styles.input} value={email} onChangeText={setEmail}
              placeholder="name.#@osu.edu" placeholderTextColor={colors.greyLight}
              keyboardType="email-address"
              autoCapitalize="none" />}
          {emailError && <Text style={styles.error}>{emailError}</Text>}
          {!passwordFor &&
          <Pressable style={[styles.button, (sending || secondsLeft > 0) && styles.buttonDisabled]}
            onPress={handleSendCode} disabled={sending || secondsLeft > 0}>
            {sending
              ? <ActivityIndicator color={colors.paper} />
              : <Text style={styles.buttonText}>{secondsLeft > 0 ? `${sendLabel} in ${secondsLeft}s` : sendLabel}</Text>}
          </Pressable>}

          {passwordFor && <>
          <Text style={[styles.label, styles.labelSpaced]}>Password</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword}
            secureTextEntry autoCapitalize="none" autoCorrect={false}
            textContentType="password" autoComplete="password"
            returnKeyType="go" onSubmitEditing={handlePasswordSignIn} />
          {passwordError && <Text style={styles.error}>{passwordError}</Text>}
          <Pressable style={[styles.button, signingIn && styles.buttonDisabled]} onPress={handlePasswordSignIn} disabled={signingIn}>
            {signingIn
              ? <ActivityIndicator color={colors.paper} />
              : <Text style={styles.buttonText}>Sign in</Text>}
          </Pressable>
          </>}

          {sentTo && <>
          <Text style={[styles.label, styles.labelSpaced]}>6-digit code</Text>
          <TextInput style={styles.input} value={code} onChangeText={setCode}
          placeholder="123456" placeholderTextColor={colors.greyLight}
          keyboardType="number-pad"/>
          {verifyError && <Text style={styles.error}>{verifyError}</Text>}
          <Pressable style={[styles.button, verifying && styles.buttonDisabled]} onPress={handleVerify} disabled={verifying}>
            {verifying
              ? <ActivityIndicator color={colors.paper} />
              : <Text style={styles.buttonText}>Verify</Text>}
          </Pressable>
          </>}
        </View>

        <Text style={styles.footer}>
          {passwordFor ? "App Review account"
            : sentTo ? `We sent a code to ${sentTo}` : "Use your OSU email and we'll send you a sign-in code"}
        </Text>
    </KeyboardAvoidingView>);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: colors.paper,
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
    fontSize: 24,
    fontWeight: "700",
    color: colors.ink,
    marginTop: 16,
    marginBottom: 24,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
    marginBottom: 6,
  },
  labelSpaced: {
    marginTop: 20,          // gap between the email step and the code step
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
  lockedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.background, // grey fill: reads as "set", not editable
    borderColor: colors.background,
  },
  lockedEmail: {
    flex: 1,                // take the row's width, leaving room for "Change"
    fontSize: 16,
    color: colors.grey,
  },
  changeText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.scarlet,
  },
  button: {
    marginTop: 12,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.scarlet,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.5,           // waiting: sending, verifying, or the resend countdown
  },
  buttonText: {
    color: colors.paper,
    fontSize: 16,
    fontWeight: "600",
  },
  error: {
    color: colors.scarlet,
    fontSize: 13,
    marginTop: 6,
  },
  footer: {
    color: colors.grey,
    fontSize: 13,
    marginTop: 20,
    textAlign: "center",
  },
});

import { supabase } from "@/lib/supabase";
import { colors } from "@/theme";
import { router } from "expo-router";
import { useState } from "react";
import MarkerPin from "@/components/MarkerPin";
import { KeyboardAvoidingView, Pressable, StyleSheet, View } from "react-native";
import { Text, TextInput } from "@/components/AppText";

export default function Login(){
    const [email, setEmail] = useState("");
    const [codeSent, setCodeSent] = useState(false);
    const [code, setCode] = useState("");
    const [emailError, setEmailError] = useState("");
    const [verifyError, setVerifyError] = useState("");
    const handleSendCode = async () => {
      
    const {error} = await supabase.auth.signInWithOtp({email});
    if (error){
      setEmailError(error.message);
      return
    }
    setEmailError("");
    setCodeSent(true);
    console.log(email);

}
const handleVerify = async() => {
  const {data, error} = 
  await supabase.auth.verifyOtp({email, token:code, type:"email"});
  if (error){
    setVerifyError("Enter a valid 6-digit code");
    return
  }
  setVerifyError("");
  console.log(data.user?.id);
  router.replace("/");
}

 
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
          <TextInput style={styles.input} value={email} onChangeText={setEmail}
          placeholder="name.#@osu.edu" placeholderTextColor={colors.greyLight}
          keyboardType="email-address"
          autoCapitalize="none" />
          {emailError && <Text style={styles.error}>{emailError}</Text>}
          <Pressable style={styles.button} onPress={handleSendCode}>
            <Text style={styles.buttonText}>{codeSent ? "Resend code" : "Continue"}</Text>
          </Pressable>

          {codeSent && <>
          <Text style={[styles.label, styles.labelSpaced]}>6-digit code</Text>
          <TextInput style={styles.input} value={code} onChangeText={setCode}
          placeholder="123456" placeholderTextColor={colors.greyLight}
          keyboardType="number-pad"/>
          {verifyError && <Text style={styles.error}>{verifyError}</Text>}
          <Pressable style={styles.button} onPress={handleVerify}>
            <Text style={styles.buttonText}>Verify</Text>
          </Pressable>
          </>}
        </View>

        <Text style={styles.footer}>
          {codeSent ? `We sent a code to ${email}` : "Use your OSU email and we'll send you a sign-in code"}
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
  button: {
    marginTop: 12,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.scarlet,
    alignItems: "center",
    justifyContent: "center",
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

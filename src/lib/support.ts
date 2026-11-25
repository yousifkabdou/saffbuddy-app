import { Alert, Linking, Platform } from "react-native";

// Forwarded to the developer's inbox by Cloudflare Email Routing. The privacy policy lists the same address.
export const SUPPORT_EMAIL = "support@saffbuddy.app";

// A mailto: link with the subject and a short template filled in. The only extra detail is the
// phone's OS and version (helps reproduce bugs); nothing about the user or their account is added,
// so whatever they send is what they chose to type.
export function supportMailto(os: string = Platform.OS, version: string | number = Platform.Version): string {
  const subject = "SaffBuddy: problem report";
  const body = `What happened: \nWhat did you expect: \n\n(${os} ${version})`;
  // encodeURIComponent turns spaces into %20 and newlines into %0A, which mail apps expect.
  // (URLSearchParams would use "+" for spaces, and some mail apps show the "+" literally.)
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// Opens the user's mail app. It fails when no mail app is set up (e.g. Mail deleted on iOS),
// so fall back to showing the address for them to copy.
export async function openSupportEmail(): Promise<void> {
  try {
    await Linking.openURL(supportMailto());
  } catch (e) {
    console.log("couldn't open the mail app", e);
    Alert.alert("Report a problem", `Email us at ${SUPPORT_EMAIL}`);
  }
}

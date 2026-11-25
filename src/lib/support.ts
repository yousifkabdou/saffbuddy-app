import { Alert, Linking, Platform } from "react-native";

// Forwarded to the developer's inbox by Cloudflare Email Routing. The privacy policy lists the same address.
export const SUPPORT_EMAIL = "support@saffbuddy.app";

// A mailto: link with the subject and a short template filled in. The only extra detail is the
// phone's OS and version (helps reproduce bugs); nothing about the user or their account is added,
// so whatever they send is what they chose to type.
export function supportMailto(os: string = Platform.OS, version: string | number = Platform.Version): string {
  const subject = "SaffBuddy: problem report";
  // Line breaks are \r\n (CRLF): the mailto standard (RFC 6068) requires it, and some mail
  // apps drop a bare \n, squashing the template onto one line.
  const body = `What happened: \r\nWhat did you expect: \r\n\r\n(${os} ${version})`;
  // encodeURIComponent turns spaces into %20 and \r\n into %0D%0A.
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

// Turns sign-in errors from Supabase Auth into messages the user can act on.
// Supabase's own messages ("For security purposes, you can only request this after 42 seconds",
// "Token has expired or is invalid") are written for developers, so we only show our own.
import { isNetworkError } from "@/lib/errors";

// The parts of a Supabase AuthError we look at. `code` is Supabase's error code
// (e.g. "otp_expired"); network failures have no code.
export type AuthErrorLike = { code?: string; message: string };

// Supabase allows one code per email address per 60 seconds (its default "email min interval").
export const RESEND_COOLDOWN_SECONDS = 60;

const NO_CONNECTION = "No connection. Check your internet and try again.";
export const OSU_ONLY = "Use your @osu.edu email address.";

// Checked in the app so a typo gets an instant answer. The server still enforces it
// (supabase/verify_osu_email.sql), so this isn't a security check.
export function isOsuEmail(email: string) {
  return /^[^\s@]+@osu\.edu$/i.test(email);
}

// A 6-digit code, nothing else (spaces from copy-paste are trimmed before this).
export function isSixDigitCode(code: string) {
  return /^\d{6}$/.test(code);
}

// Seconds left in Supabase's "only request this after N seconds" message, or null.
export function secondsToWait(message: string): number | null {
  const match = message.match(/after (\d+) seconds?/i);
  return match ? Number(match[1]) : null;
}

export function sendCodeErrorMessage(error: AuthErrorLike): string {
  if (isNetworkError(error)) return NO_CONNECTION;
  const wait = secondsToWait(error.message);
  if (wait !== null) return `Wait ${wait} seconds before asking for another code.`;
  if (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit")
    return "Too many codes requested. Wait a few minutes and try again.";
  if (error.code === "email_address_invalid" || error.code === "validation_failed")
    return "Enter a valid email address.";
  // Our sign-up hook's refusal (non-OSU email) comes back with its own message.
  if (/osu\.edu/i.test(error.message)) return OSU_ONLY;
  return "Couldn't send the code. Try again in a minute.";
}

export function verifyCodeErrorMessage(error: AuthErrorLike): string {
  if (isNetworkError(error)) return NO_CONNECTION;
  // Supabase uses otp_expired for both a wrong code and an expired one; it can't tell us which.
  if (error.code === "otp_expired") return "That code is wrong or has expired. Check it, or tap Resend code.";
  if (error.code === "over_request_rate_limit") return "Too many tries. Wait a few minutes and try again.";
  return "Couldn't verify the code. Try again.";
}

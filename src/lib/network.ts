import { getNetworkStateAsync } from "expo-network";
import { AppError } from "@/lib/errors";

// The error we report when we know the phone is offline. No code + "Network request failed",
// so isNetworkError() in errors.ts treats it exactly like a real failed fetch.
export const OFFLINE_ERROR: AppError = { message: "Network request failed" };

// True only when the phone is definitely offline (airplane mode, no Wi-Fi or cellular).
// Asking the phone is instant, while a fetch with no connection can take seconds to fail.
// We only trust a clear "not connected": if the check itself fails or is unsure,
// say "not offline" and let the real request decide.
export async function isOffline() {
  try {
    const state = await getNetworkStateAsync();
    return state.isConnected === false;
  } catch {
    return false;
  }
}

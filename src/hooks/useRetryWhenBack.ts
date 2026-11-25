import { addNetworkStateListener } from "expo-network";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";

// While `active` is true (something failed to load), calls `retry` on its own when the phone
// reconnects or the app comes back to the front, so the user doesn't have to notice the
// banner and tap it. Listeners exist only while active, and are removed when it turns false.
export function useRetryWhenBack(active: boolean, retry: () => void) {
  // The latest retry function, so the listeners (set up once per `active` change) never call
  // an old copy that sees stale state.
  const retryRef = useRef(retry);
  useEffect(() => {
    retryRef.current = retry;
  });

  useEffect(() => {
    if (!active) return;
    const network = addNetworkStateListener(({ isConnected }) => {
      if (isConnected) retryRef.current();
    });
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") retryRef.current();
    });
    return () => {
      network.remove();
      appState.remove();
    };
  }, [active]);
}

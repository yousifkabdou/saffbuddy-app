import { Redirect } from "expo-router"; //Redirect a component that takes the user to its href (replaces)
import { Tabs } from "expo-router/js-tabs"; //Tabs are the tabs on the bottom
import { ActivityIndicator, View } from "react-native";
import FloatingTabBar from "@/components/FloatingTabBar";
import { supabase } from "@/lib/supabase"; //My login source
import { useEffect, useState } from "react"; //useEffect executes a code once after the screen is drawn, useState stores a value that survives redraws
import { Session } from "@supabase/supabase-js";
import { RequestsProvider } from "@/context/RequestsContext";
import StatusOverlay from "@/components/StatusOverlay";
import SideMenu from "@/components/SideMenu";
import LoadFailedScreen from "@/components/LoadFailedScreen";
import { gateFor } from "@/lib/gate";
import { isNetworkError } from "@/lib/errors";
import { useRetryWhenBack } from "@/hooks/useRetryWhenBack";
import { colors } from "@/theme";

export default function TabsLayout() {

  const [session, setSession] = useState<Session | null>(null); //current session info can only be Session or null, setSession to change it
  const [loading, setLoading] = useState(true); //Loading status set as true
  const [hasProfile, setHasProfile] = useState(false);
  // The session check failed on the network (offline, token needed refreshing). The session may
  // still be valid and saved on the phone, so this shows Retry instead of sending them to login.
  const [sessionFailed, setSessionFailed] = useState(false);
  // The profile check itself failed (offline, server error). Kept separate from hasProfile:
  // "couldn't check" is not the same as "has no profile", and treating it that way sent
  // existing users to the setup screen.
  const [profileFailed, setProfileFailed] = useState(false);
  // Whether the last failure was the connection or something on the server, for the hint text.
  const [failedOnNetwork, setFailedOnNetwork] = useState(true);
  const [retrying, setRetrying] = useState(false);

  const checkSession = async () => {
    const { data, error } = await supabase.auth.getSession(); //returns a data and error
    if (error) {
      console.log(error.message);
      // AuthRetryableFetchError = the refresh never reached the server. Any other auth error
      // (e.g. a revoked refresh token) means the session really is over: auth-js has already
      // removed it, so falling through to "no session" sends them to login.
      const network = error.name === "AuthRetryableFetchError" || isNetworkError(error);
      setSessionFailed(network);
      setFailedOnNetwork(network);
      setLoading(false);
      return;
    }
    setSessionFailed(false);
    if (!data.session){
      setLoading(false);
      return;
    }
    setSession(data.session);

    const userID = data.session.user.id;

    const { data: profileData, error: profileError } = await supabase.from("profiles").select("id").eq("id", userID).maybeSingle();

    if (profileError) {
      console.log(profileError.message);
      setProfileFailed(true);
      setFailedOnNetwork(isNetworkError(profileError));
      setLoading(false);
      return;
    }
    setProfileFailed(false);
    setHasProfile(profileData !== null);
    setLoading(false);
  }

  const retryProfile = async () => {
    if (retrying) return; // a tap and an automatic retry can arrive together
    setRetrying(true);
    try {
      await checkSession();
    } finally {
      setRetrying(false); // even if something throws, the button must not stay disabled
    }
  };

  useEffect(() => { //checking the current session
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; state is only set after the awaits, when data arrives
    checkSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => { setSession(newSession) });

    return () => {
      subscription.unsubscribe();
    }

  }, []);

  const gate = gateFor({ loading, hasSession: session !== null, sessionFailed, profileFailed, hasProfile });

  // While the Retry screen is up, try again by itself when the connection or the app comes back.
  useRetryWhenBack(gate === "retry", retryProfile);

  if (gate === "wait") {
    // A spinner, not a blank screen: on slow Wi-Fi this can take a few seconds.
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper }}>
        <ActivityIndicator size="large" color={colors.grey} />
      </View>
    );
  }
  else if (gate === "login") {
    return <Redirect href="/login" />
  }
  else if (gate === "retry") {
    return <LoadFailedScreen
      message={sessionFailed ? "Couldn't connect" : "Couldn't load your profile"}
      hint={failedOnNetwork ? undefined : "Something went wrong on our end. Try again in a moment."}
      onRetry={retryProfile}
      retrying={retrying} />
  }
  else if (gate === "setup") {
    return <Redirect href="/setup" />
  }
  else {

    // RequestsProvider loads request data once, here, so every tab below shares the same copy.
    // It's inside this branch so it only mounts once there's a session and a profile.
    // StatusOverlay sits on top of the tabs and shows load/action errors on any tab.
    return <RequestsProvider>
    <View style={{ flex: 1 }}>
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{
        title: "Home",
        headerShown: false, // no "Home" title bar; the map fills the screen with the prayer countdown on top
      }} />
      <Tabs.Screen name="requests" options={{
        title: "Requests",
        headerShown: false, // the screen draws its own floating glass title
      }} />
      <Tabs.Screen name="times" options={{
        title: "Prayer Times",
        headerShown: false, // the screen draws its own floating glass title
      }} />
    </Tabs>
    <StatusOverlay />
    <SideMenu />
    </View>
    </RequestsProvider>;

  }
}

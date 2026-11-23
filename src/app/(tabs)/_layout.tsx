import { Redirect } from "expo-router"; //Redirect a component that takes the user to its href (replaces)
import { Tabs } from "expo-router/js-tabs"; //Tabs are the tabs on the bottom
import { View } from "react-native";
import FloatingTabBar from "@/components/FloatingTabBar";
import { supabase } from "@/lib/supabase"; //My login source
import { useEffect, useState } from "react"; //useEffect executes a code once after the screen is drawn, useState stores a value that survives redraws
import { Session } from "@supabase/supabase-js";
import { RequestsProvider } from "@/context/RequestsContext";
import StatusOverlay from "@/components/StatusOverlay";
import SideMenu from "@/components/SideMenu";
import LoadFailedScreen from "@/components/LoadFailedScreen";
export default function TabsLayout() {

  const [session, setSession] = useState<Session | null>(null); //current session info can only be Session or null, setSession to change it
  const [loading, setLoading] = useState(true); //Loading status set as true
  const [hasProfile, setHasProfile] = useState(false);
  // The profile check itself failed (offline, server error). Kept separate from hasProfile:
  // "couldn't check" is not the same as "has no profile", and treating it that way sent
  // existing users to the setup screen.
  const [profileFailed, setProfileFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const checkSession = async () => {
    const { data, error } = await supabase.auth.getSession(); //returns a data and error 
    if (error) { //if error is null then its false, if error containts an object (when theres an error) it is true
      console.log(data.session);
      setLoading(false);
      console.log(error.message);
      return
    }
    if (!data.session){
      setLoading(false);
      return;
    }
    setSession(data.session);

    const userID = data.session?.user.id;

    const { data: profileData, error: profileError } = await supabase.from("profiles").select("id").eq("id", userID).maybeSingle();

    if (profileError) {
      console.log(profileError.message);
      setProfileFailed(true);
      setLoading(false);
      return;
    }
    setProfileFailed(false);
    setHasProfile(profileData !== null);
    setLoading(false);
  }

  const retryProfile = async () => {
    setRetrying(true);
    await checkSession();
    setRetrying(false);
  };


  useEffect(() => { //checking the current session
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; state is only set after the awaits, when data arrives
    checkSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => { setSession(newSession) });

    return () => {
      subscription.unsubscribe();
    }

  }, []);

  if (loading) {
    return null
  }
  else if (!session) {
    return <Redirect href="/login" />

  }
  else if (profileFailed) {
    return <LoadFailedScreen message="Couldn't load your profile" onRetry={retryProfile} retrying={retrying} />
  }
  else if (!hasProfile) {
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

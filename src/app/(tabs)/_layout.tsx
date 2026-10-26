import { Redirect } from "expo-router"; //Redirect a component that takes the user to its href (replaces)
import { Tabs } from "expo-router/js-tabs"; //Tabs are the tabs on the bottom
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { supabase } from "@/lib/supabase"; //My login source
import { useEffect, useState } from "react"; //useEffect executes a code once after the screen is drawn, useState stores a value that survives redraws
import {Session} from "@supabase/supabase-js";
export default function TabsLayout() {

  const [session, setSession] = useState<Session | null>(null); //current session info can only be Session or null, setSession to change it
  const [loading, setLoading] = useState(true); //Loading status set as true

  const checkSession = async ()=>{
  const {data, error} = await supabase.auth.getSession(); //returns a data and error 
  if (error){ //if error is null then its false, if error containts an object (when theres an error) it is true
    console.log(data.session);
    setLoading(false);
    console.log(error.message);
    return 
}
    setLoading(false);
    setSession(data.session);
  }


 useEffect( () => { //checking the current session
  checkSession();
  const {data: {subscription}} = supabase.auth.onAuthStateChange((_event, newSession) => {setSession(newSession)});
  
  return () => {
    subscription.unsubscribe();
  }

}, []);

  if (loading){
    return null
  }
  else if (!session){
    return <Redirect href="/login"/>

  }
  else{

  return <Tabs screenOptions={{
      tabBarStyle: styles.tabBar,
      tabBarShowLabel: false,
    }}>
    <Tabs.Screen name = "index" options={{
      title: "Home",
      tabBarIcon: ({ focused }) => <TabCircle icon="home" focused={focused} />,
    }} />
    <Tabs.Screen name = "times" options = {{
      title:"Prayer Times",
      tabBarIcon: ({ focused }) => <TabCircle icon="time" focused={focused} />,
    }} />
    </Tabs>;

  }
}

// A round tab button: black when its tab is open, white otherwise.
function TabCircle({ icon, focused }: { icon: "home" | "time"; focused: boolean }) {
  return (
    <View style={[styles.circle, focused && styles.circleFocused]}>
      <Ionicons name={icon} size={24} color={focused ? "white" : "black"} />
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",          // float over the screen so the map shows behind it
    backgroundColor: "transparent",
    borderTopWidth: 0,             // remove the iOS divider line
    elevation: 0,                  // remove the Android shadow
    height: 90,
  },
  circle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,

    // shadow so the circle stands out on the map
    shadowColor: "black",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  circleFocused: {
    backgroundColor: "black",
  },
});

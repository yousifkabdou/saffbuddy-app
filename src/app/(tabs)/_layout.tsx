import { Tabs, Redirect } from "expo-router"; //Tabs are the tabs on the bottom, Redirect a component that takes the user to its href (replaces)
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

  return <Tabs>
    <Tabs.Screen name = "index" options={{title: "Home" }} />
    <Tabs.Screen name = "times" options = {{title:"Prayer Times"}} />
    </Tabs>;

  }
}

import { Tabs, Redirect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";

export default function TabsLayout() {

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const checkSession = async ()=>{
  const {data, error} = await supabase.auth.getSession();
  if (error){
    console.log(data.session);
    setLoading(false);
    console.log(error.message);
    return 
}
    setLoading(false);
  }

 useEffect( () => {
  checkSession();
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

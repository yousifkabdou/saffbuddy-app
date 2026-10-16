import { Tabs } from "expo-router";

export default function RootLayout() {
  return <Tabs>
    <Tabs.Screen name = "index" options={{title: "Home" }} />
    <Tabs.Screen name = "times" options = {{title:"Prayer Times"}} />
    </Tabs>;
}

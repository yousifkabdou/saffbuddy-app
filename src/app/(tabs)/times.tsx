import { StyleSheet, Text, TextInput, View, Button } from "react-native";
import { useState } from "react";
import { supabase } from "@/lib/supabase";


export default function Times() {

      const handleSignOut = async () => {
      const {error} = await supabase.auth.signOut();

      if (error){
        console.log(error.message);
      }
    }
  return (
    <View style={styles.container}>
    <Button title="Sign Out" onPress={handleSignOut}/>
      <Text>Times.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

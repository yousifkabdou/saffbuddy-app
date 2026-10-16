import { useState } from "react";
import { Button, StyleSheet, Text, TextInput, View } from "react-native";
import {supabase} from "@/lib/supabase"

export default function login(){
    const [email, setEmail] = useState("");
    const [codeSent, setCodeSent] = useState(false);
    const [code, setCode] = useState("");
    return (
    <View style={styles.container} >
        <Text>Login</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail}
        placeholder="name.#osu.edu" placeholderTextColor="gray" 
        keyboardType="email-address" 
        autoCapitalize="none" />
        <Button title="Send Code" onPress={() =>{
            console.log(email)
            setCodeSent(true);
        }}/>
        {codeSent && <>
        <TextInput style={styles.input} value={code} onChangeText={setCode}
        placeholder="6-digit code" placeholderTextColor="gray" 
        keyboardType="number-pad"/>
        <Button title="Verify" onPress={ () => console.log(code)}/>
        </>}
    </View>);
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    width: "80%",
    borderWidth: 1,
    borderColor: "gray",
    borderRadius: 8,
    padding: 10,
    marginVertical: 8,
  },
});

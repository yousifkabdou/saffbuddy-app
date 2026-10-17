import { supabase } from "@/lib/supabase";
import { useState } from "react";
import { Button, StyleSheet, Text, TextInput, View } from "react-native";

export default function login(){
    const [email, setEmail] = useState("");
    const [codeSent, setCodeSent] = useState(false);
    const [code, setCode] = useState("");
    const handleSendCode = async () => {
      
    const {error} = await supabase.auth.signInWithOtp({email});
    if (error){
      console.log(error.message);
      return
    }
    setCodeSent(true);
    console.log(email);

}
const handleVerify = async() => {
  const {data, error} = 
  await supabase.auth.verifyOtp({email, token:code, type:"email"});
  if (error){
    console.log(error.message);
    return
  }
  console.log(data.user?.id);
}

 
    return (
    <View style={styles.container} >
        <Text>Login</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail}
        placeholder="name.#osu.edu" placeholderTextColor="gray" 
        keyboardType="email-address" 
        autoCapitalize="none" />
        <Button title="Send Code" onPress={handleSendCode} />
        {codeSent && <>
        <TextInput style={styles.input} value={code} onChangeText={setCode}
        placeholder="6-digit code" placeholderTextColor="gray" 
        keyboardType="number-pad"/>
        <Button title="Verify" onPress={handleVerify}/>
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

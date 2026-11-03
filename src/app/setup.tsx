import { supabase } from "@/lib/supabase";
import { router } from "expo-router";
import { useState } from "react";
import { Button, Pressable, StyleSheet, Text, TextInput, View } from "react-native";


type Gender = "Men" | "Women";

// What the user sees vs. what gets saved (must match the profiles check constraint)
const genderOptions: { label: string; value: Gender }[] = [
  { label: "Brother", value: "Men" },
  { label: "Sister", value: "Women" },
];

export default function setup(){
    const [firstName, setFirstName] = useState("");
    const [errorState, setErrorState] = useState<string | false>(false);
    const [gender, setGender] = useState<Gender | null>(null);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [nameError, setNameError] = useState("");

    const validateName = (name: string) => {
      if (name.length < 2 || name.length > 20) return "Name must be 2 to 20 characters";
      if (!/^[A-Za-z]+([ '’-][A-Za-z]+)*$/.test(name)) return "Name can only contain letters, spaces, hyphens and apostrophes";
      return "";
    }

    const handleSave = async () => {
    setErrorState(false);
      const error = validateName(firstName.trim());
      const {data} = await supabase.auth.getSession();
      const userID = data.session?.user.id;
      setNameError(error);
      if (error){
        return
      }
       const {error:insertError} = await supabase.from("profiles")
       .insert({id : userID, first_name: firstName.trim(), gender: gender});

       if (insertError){
        if (insertError.code === '23505'){
        setErrorState("You've already set up a profile");
        return;
        }
        if (insertError.code === '23514'){
        setErrorState("Please check your name and try again");
        return;
        }
        else{
        setErrorState('Something went wrong please try again. Error code: ${insertError.code}');
        return;
        }
       }
       router.replace("/");
      // your save logic goes here
    }

    const selectedLabel = genderOptions.find(o => o.value === gender)?.label;

    return (
   
    <View style={styles.container}>
        <Text style={styles.header}>Welcome to SaffBuddy</Text>
        <Text style={styles.subtext}>Tell us a bit about yourself to get started.</Text>


        <TextInput style={styles.input} value={firstName} onChangeText={setFirstName}
        placeholder="First name" placeholderTextColor="gray"
        autoCapitalize="words" maxLength={20} />
        

        <Pressable style={styles.input} onPress={() => setPickerOpen(!pickerOpen)}>
          <Text style={{ color: selectedLabel ? "black" : "gray" }}>
            {selectedLabel ?? "Select gender"}
          </Text>
        </Pressable>
        {pickerOpen && <View style={styles.options}>
          {genderOptions.map(option => (
            <Pressable key={option.value} style={styles.option}
            onPress={() => { setGender(option.value); setPickerOpen(false); }}>
              <Text>{option.label}</Text>
            </Pressable>
          ))}
        </View>}
        <Text style={styles.note}>This can't be changed later.</Text>

        <Button title="Save" onPress={handleSave} disabled={!gender} />
        {nameError && <Text style={styles.error}>{nameError}</Text>}
         {errorState && <Text style={styles.error}>{errorState}</Text>}

    </View> 
    );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
  },
  subtext: {
    color: "gray",
    marginTop: 4,
    marginBottom: 16,
  },
  input: {
    width: "80%",
    borderWidth: 1,
    borderColor: "gray",
    borderRadius: 8,
    padding: 10,
    marginVertical: 8,
  },
  options: {
    width: "80%",
    borderWidth: 1,
    borderColor: "gray",
    borderRadius: 8,
  },
  option: {
    padding: 10,
  },
  note: {
    width: "80%",
    color: "gray",
    fontSize: 12,
  },
  error: {
    width: "80%",
    borderWidth: 1,
    color: "red",
    borderColor: "red",
    borderRadius: 8,
    padding: 10,
    marginVertical: 8,
  }
});

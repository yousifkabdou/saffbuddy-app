import { supabase } from "@/lib/supabase";
import { colors } from "@/theme";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, TextInput } from "@/components/AppText";


type Gender = "Men" | "Women";

// What the user sees vs. what gets saved (must match the profiles check constraint)
const genderOptions: { label: string; value: Gender }[] = [
  { label: "Brother", value: "Men" },
  { label: "Sister", value: "Women" },
];

export default function Setup(){
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
        // A profile already exists (primary key clash), so there's nothing to set up: go home.
        router.replace("/");
        return;
        }
        if (insertError.code === '23514'){
        setErrorState("Please check your name and try again");
        return;
        }
        else{
        setErrorState(`Something went wrong please try again. Error code: ${insertError.code}`);
        return;
        }
       }
       router.replace("/");
    }

    const selectedLabel = genderOptions.find(o => o.value === gender)?.label;

    return (
   
    <View style={styles.container}>
        <Text style={styles.header}>Welcome to SaffBuddy</Text>
        <Text style={styles.subtext}>Tell us a bit about yourself to get started</Text>


        <Text style={styles.label}>First name</Text>
        <TextInput style={styles.input} value={firstName} onChangeText={setFirstName}
        autoCapitalize="words" maxLength={20} />
        

        <Pressable style={styles.input} onPress={() => setPickerOpen(!pickerOpen)}>
          <Text style={{ color: selectedLabel ? colors.ink : colors.greyLight }}>
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
        <Text style={styles.note}>This can’t be changed later</Text>

        {/* Disabled (and faded) until a gender is picked, same as before. */}
        <Pressable style={[styles.saveButton, !gender && styles.saveDisabled]} onPress={handleSave} disabled={!gender}>
          <Text style={styles.saveText}>Save</Text>
        </Pressable>
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
    color: colors.grey,
    marginTop: 4,
    marginBottom: 16,
  },
  label: {
    width: "80%",
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
    marginTop: 8,
  },
  input: {
    width: "80%",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    padding: 10,
    marginVertical: 8,
  },
  options: {
    width: "80%",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
  },
  option: {
    padding: 10,
  },
  note: {
    width: "80%",
    color: colors.grey,
    fontSize: 12,
  },
  saveButton: {
    width: "80%",
    height: 50,
    borderRadius: 25,       // half the height = pill
    backgroundColor: colors.scarlet,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  saveDisabled: {
    opacity: 0.4,
  },
  saveText: {
    color: colors.paper,
    fontSize: 16,
    fontWeight: "600",
  },
  error: {
    width: "80%",
    borderWidth: 1,
    color: colors.scarlet,
    borderColor: colors.scarlet,
    borderRadius: 8,
    padding: 10,
    marginVertical: 8,
  }
});

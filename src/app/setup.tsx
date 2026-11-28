import { normalizeName, validateName } from "@/lib/name";
import { isOffline } from "@/lib/network";
import { NO_CONNECTION, setupOutcome } from "@/lib/setupOutcome";
import { supabase } from "@/lib/supabase";
import { colors } from "@/theme";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
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

    // True while the save is on its way: the button shows a spinner and ignores taps, so a slow
    // network can't send the insert two or three times.
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
      if (saving) return;
      setErrorState(false);
      const name = normalizeName(firstName);
      const error = validateName(name); // same rule as the database (src/lib/name.ts)
      setNameError(error);
      if (error) return;

      setSaving(true);
      try {
        if (await isOffline()) {
          setErrorState(NO_CONNECTION);
          return;
        }
        const {data} = await supabase.auth.getSession();
        const userID = data.session?.user.id;
        if (!userID) {
          // No session (signed out elsewhere, or it couldn't be refreshed): saving would be
          // refused anyway, so go back to login instead of showing a confusing error.
          router.replace("/login");
          return;
        }
        const {error:insertError} = await supabase.from("profiles")
          .insert({id : userID, first_name: name, gender: gender});
        if (insertError) console.log(insertError.message);

        // New profile -> welcome screen; one that already existed -> home; otherwise a message.
        const outcome = setupOutcome(insertError);
        if ("error" in outcome) {
          setErrorState(outcome.error);
          return;
        }
        router.replace(outcome.go === "welcome" ? "/welcome" : "/");
      } finally {
        setSaving(false);
      }
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
        <Pressable style={[styles.saveButton, (!gender || saving) && styles.saveDisabled]} onPress={handleSave} disabled={!gender || saving}>
          {saving
            ? <ActivityIndicator color={colors.paper} />
            : <Text style={styles.saveText}>Save</Text>}
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

// The first-name rule. The database enforces the same rule (first_name_valid in
// supabase/profile.sql); keep the two in step. This copy exists so the user sees why right away.

// A-Z plus Latin letters with accents: À-Ö, Ø-ö, ø-ÿ (skipping × and ÷) and Ā-ſ (Latin Extended-A).
const LETTERS = "A-Za-zÀ-ÖØ-öø-ÿĀ-ſ";
// Words of letters, joined by one space, hyphen or apostrophe (straight or curly).
const NAME_PATTERN = new RegExp(`^[${LETTERS}]+([ '’-][${LETTERS}]+)*$`, "u");

// What gets saved: trimmed, and in NFC form, so "é" is one character whichever way the keyboard
// typed it (as "é", or as "e" plus a combining accent, which the database rule would refuse).
export function normalizeName(raw: string) {
  return raw.trim().normalize("NFC");
}

// "" if the name is fine, otherwise the message to show. Expects a normalized name.
export function validateName(name: string) {
  const length = [...name].length; // counts characters the way Postgres's char_length does
  if (length < 2 || length > 20) return "Name must be 2 to 20 characters";
  if (!NAME_PATTERN.test(name)) return "Name can only contain letters, spaces, hyphens and apostrophes";
  return "";
}

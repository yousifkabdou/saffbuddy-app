// How copy refers to another person, based on the viewer's gender.
// Requests are same-gender only, so the other person always matches the viewer.
// null = gender not loaded yet (or the fetch failed), so stay neutral.
export function otherPerson(viewerGender: "Men" | "Women" | null) {
  if (viewerGender === "Men") return "a brother";
  if (viewerGender === "Women") return "a sister";
  return "someone";
}

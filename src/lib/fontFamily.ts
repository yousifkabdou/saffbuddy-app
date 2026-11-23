// Picks the font file for a piece of text. Pure logic (no font files imported), so it can be tested.
//
// Custom fonts in React Native: each weight is a separate font file with its own family name,
// so fontWeight can't choose a weight. Instead we turn the weight into a family name
// (e.g. 700 -> "WorkSans_700Bold"). The files themselves are loaded in src/fonts.ts.
//
// The app uses two fonts:
// - Reem Kufi for headings (text DISPLAY_MIN_SIZE and up): a Latin font drawn in the style of
//   Kufic Arabic calligraphy.
// - Work Sans for everything else, and for any text that asks for tabular (equal-width) digits.
//   Reem Kufi's digits are different widths ("1" is about half a "0") and it has no tabular
//   option, so a ticking countdown in it would shift sideways every second.

export type Weight = 400 | 600 | 700 | 800;

// Heading-sized text in the app is 20+; buttons and body text are 13-18.
export const DISPLAY_MIN_SIZE = 20;

export const BODY: Record<Weight, string> = {
  400: "WorkSans_400Regular",
  600: "WorkSans_600SemiBold",
  700: "WorkSans_700Bold",
  800: "WorkSans_800ExtraBold",
};

export const DISPLAY: Record<Weight, string> = {
  400: "ReemKufi_400Regular",
  600: "ReemKufi_600SemiBold",
  700: "ReemKufi_700Bold",
  800: "ReemKufi_700Bold", // Reem Kufi's heaviest weight is 700
};

// Rounds any fontWeight ("bold", "600", 500, undefined...) to a weight we have a file for.
export function toWeight(fontWeight: unknown): Weight {
  const n = fontWeight === "bold" ? 700 : Number(fontWeight ?? 400);
  if (Number.isNaN(n) || n < 500) return 400;
  if (n < 650) return 600;
  if (n < 750) return 700;
  return 800;
}

export function fontFamilyFor(fontWeight: unknown, fontSize: number | undefined, tabularNums: boolean): string {
  const isHeading = (fontSize ?? 0) >= DISPLAY_MIN_SIZE && !tabularNums;
  return (isHeading ? DISPLAY : BODY)[toWeight(fontWeight)];
}

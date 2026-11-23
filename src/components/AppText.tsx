import { fontFamilyFor } from "@/lib/fontFamily";
import { createContext, useContext, type ComponentProps } from "react";
import { Text as RNText, TextInput as RNTextInput, StyleSheet, type StyleProp, type TextStyle } from "react-native";

// Drop-in replacements for React Native's Text and TextInput that apply the app font.
// Screens import { Text } from "@/components/AppText" instead of from "react-native".
// They pick the font file from the style's fontWeight, fontSize and fontVariant (see src/lib/fontFamily.ts),
// so existing styles like { fontSize: 24, fontWeight: "800" } keep working unchanged.

// Text inside Text inherits its parent's font, like on the web. To keep that, a nested Text
// that sets neither weight nor size gets no font of its own. The context tells a Text whether
// it's nested, and the parent's size (a nested bold word should match its parent's size).
const ParentText = createContext<{ fontSize?: number } | null>(null);

function withFont(style: StyleProp<TextStyle>, parent: { fontSize?: number } | null) {
  const flat = StyleSheet.flatten(style) ?? {};
  if (flat.fontFamily) return { style, fontSize: flat.fontSize }; // a style chose its own font
  if (parent && flat.fontWeight === undefined && flat.fontSize === undefined) {
    return { style, fontSize: parent.fontSize }; // inherit the parent's font
  }
  const fontSize = flat.fontSize ?? parent?.fontSize;
  const tabularNums = flat.fontVariant?.includes("tabular-nums") ?? false;
  const family = fontFamilyFor(flat.fontWeight, fontSize, tabularNums);
  // Each weight is its own family, so drop fontWeight: on iOS a weight plus a custom family
  // can make it fall back to the system font, and on Android it fakes bold on top.
  const { fontWeight: _unused, ...rest } = flat;
  return { style: { ...rest, fontFamily: family }, fontSize };
}

export function Text({ style, ...props }: ComponentProps<typeof RNText>) {
  const parent = useContext(ParentText);
  const { style: fontStyle, fontSize } = withFont(style, parent);
  return (
    <ParentText.Provider value={{ fontSize }}>
      <RNText {...props} style={fontStyle} />
    </ParentText.Provider>
  );
}

export function TextInput({ style, ...props }: ComponentProps<typeof RNTextInput>) {
  return <RNTextInput {...props} style={withFont(style, null).style} />;
}

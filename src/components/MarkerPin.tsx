import { colors } from "@/theme";
import Svg, { Circle, Path, Rect } from "react-native-svg";

// Map pin with a mosque dome. Drawn as SVG (not an image) so its colours can change.
// Colours come from the theme: colors.marker normally, colors.markerSelected for the open room.
// height sets the size; the width keeps the pin's shape.
// color / iconColor override the theme (e.g. a white pin on the scarlet login logo).
export default function MarkerPin({ selected, height = 44, color, iconColor }: {
  selected: boolean; height?: number; color?: string; iconColor?: string;
}) {
  const pin = color ?? (selected ? colors.markerSelected : colors.marker);
  const icon = iconColor ?? colors.paper; // circle behind the dome
  return (
    <Svg width={(height * 40) / 52} height={height} viewBox="0 0 40 52">
      {/* Teardrop: round head, point at the bottom (the point sits on the room's coordinate). */}
      <Path
        d="M20 50 C20 50 2 31 2 20 A18 18 0 1 1 38 20 C38 31 20 50 20 50 Z"
        fill={pin}
      />
      <Circle cx={20} cy={20} r={11} fill={icon} />
      {/* Onion dome + base, in the pin colour so it reads as a cut-out. */}
      <Path
        d="M20 11 C21 13.5 25.5 15 25.5 19 C25.5 21 24.5 22.5 24.5 22.5 L15.5 22.5 C15.5 22.5 14.5 21 14.5 19 C14.5 15 19 13.5 20 11 Z"
        fill={pin}
      />
      <Rect x={14} y={23} width={12} height={4.5} fill={pin} />
    </Svg>
  );
}

// Small dot used instead of the pin when the map is zoomed out, so nearby rooms don't overlap.
// Same colours as the pin, with a white edge so it stands out on the map.
export function MarkerDot({ selected }: { selected: boolean }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14">
      <Circle cx={7} cy={7} r={5.5} fill={selected ? colors.markerSelected : colors.marker} stroke={colors.paper} strokeWidth={1.5} />
    </Svg>
  );
}

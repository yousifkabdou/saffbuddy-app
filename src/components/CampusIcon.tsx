import { colors } from "@/theme";
import Svg, { Ellipse } from "react-native-svg";

// Icon for the "back to campus" button: a plain oval scarlet O (taller than wide, like a 0) with a grey edge.
// Deliberately not the Block O (an Ohio State trademark), so it's safe to ship.
const SCARLET = colors.scarlet;
const GREY = colors.grey;

export default function CampusIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Ellipse cx={12} cy={12} rx={7.5} ry={9} fill="none" stroke={GREY} strokeWidth={6} />
      <Ellipse cx={12} cy={12} rx={7.5} ry={9} fill="none" stroke={SCARLET} strokeWidth={4} />
    </Svg>
  );
}

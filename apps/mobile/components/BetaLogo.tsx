import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '@/constants/theme';

// Logo Beta (source : docs/beta-logo.svg). viewBox 48×48, couleur = ink.
export function BetaLogo({
  size = 28,
  color = colors.ink,
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Path
        d="M12.6 37.8 L17.6 34.9"
        stroke={color}
        strokeWidth={2.8}
        strokeLinecap="round"
      />
      <Path
        d="M19.2 30.6 L18 23 M22.4 30.2 L21.2 22.6"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <Path
        d="M22.8 17.9 L27.2 15.4"
        stroke={color}
        strokeWidth={2.8}
        strokeLinecap="round"
      />
      <Path
        d="M24.2 35.4 L26.4 37.2"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <Circle cx={9} cy={40} r={4.2} fill={color} />
      <Circle cx={21} cy={33.6} r={4.6} fill={color} />
      <Circle cx={19.4} cy={19.6} r={4.2} fill={color} />
      <Circle cx={31.5} cy={12.6} r={5.4} fill={color} />
      <Circle cx={28.8} cy={39} r={3} fill={color} />
    </Svg>
  );
}

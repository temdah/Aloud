import { useMemo, type ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../../theme';

export type CircularProgressProps = {
  /** 0..1 fraction complete. */
  value: number;
  /** Ring diameter. */
  size?: number;
  stroke?: number;
  /** Progress arc colour (defaults to the accent). */
  color?: string;
  /** Unfilled track colour (defaults to a faint border). */
  trackColor?: string;
  /** Centred content (e.g. an icon or percentage). */
  children?: ReactNode;
};

// A determinate progress ring (distinct from the indeterminate ProcessingRing).
// Used on the Library row to show how far a full-audiobook render has gotten.
export function CircularProgress({ value, size = 30, stroke = 3, color, trackColor, children }: CircularProgressProps) {
  const { palette: p } = useTheme();
  const arc = color ?? p.primary;
  const track = trackColor ?? p.border;
  const v = Math.max(0, Math.min(1, value));

  const { r, circ } = useMemo(() => {
    const radius = (size - stroke) / 2;
    return { r: radius, circ: 2 * Math.PI * radius };
  }, [size, stroke]);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={arc}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - v)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

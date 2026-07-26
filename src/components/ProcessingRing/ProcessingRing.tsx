import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../../theme';

export type ProcessingRingProps = {
  active: boolean; // spin + fade in while true, fade out when false
  size?: number; // should be a touch larger than the button it wraps
  color?: string;
};

const STROKE = 3;

// Spinning accent arc that fades in around the play button while a chunk is
// being synthesized, then fades out when it starts playing.
export function ProcessingRing({ active, size = 68, color }: ProcessingRingProps) {
  const { palette: p } = useTheme();
  const ringColor = color ?? p.primary;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const { r, circ, arc } = useMemo(() => {
    const radius = (size - STROKE) / 2;
    const circumference = 2 * Math.PI * radius;
    return { r: radius, circ: circumference, arc: circumference * 0.3 };
  }, [size]);

  useEffect(() => {
    if (active) {
      rotate.setValue(0);
      const loop = Animated.loop(
        Animated.timing(rotate, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }),
      );
      loop.start();
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      return () => loop.stop();
    }
    Animated.timing(opacity, { toValue: 0, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
  }, [active, rotate, opacity]);

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', width: size, height: size, opacity, transform: [{ rotate: spin }] }}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={ringColor}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${circ}`}
        />
      </Svg>
    </Animated.View>
  );
}

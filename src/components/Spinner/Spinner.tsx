import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../../theme';

export type SpinnerProps = { size?: number; color?: string };

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

export function Spinner({ size = 18, color }: SpinnerProps) {
  const { palette } = useTheme();
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <AnimatedSvg width={size} height={size} viewBox="0 0 24 24" style={{ transform: [{ rotate }] }}>
      <Circle cx="12" cy="12" r="9" fill="none" stroke={color ?? palette.onPrimary} strokeWidth={2.2} strokeLinecap="round" strokeDasharray="14 40" />
    </AnimatedSvg>
  );
}

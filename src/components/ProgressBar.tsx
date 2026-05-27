import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { useTheme } from '../theme';
import type { ProgressBarProps } from './componentTypes';

export function ProgressBar({ value = 0, indeterminate = false, height = 6, color }: ProgressBarProps) {
  const { palette: p } = useTheme();
  const c = color ?? p.primary;
  const [trackWidth, setTrackWidth] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!indeterminate || trackWidth === 0) return;
    const loop = Animated.loop(
      Animated.timing(anim, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [indeterminate, trackWidth, anim]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-0.4 * trackWidth, trackWidth],
  });

  return (
    <View
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      style={{ width: '100%', height, borderRadius: height / 2, backgroundColor: p.surfaceSunk, overflow: 'hidden' }}
    >
      {indeterminate ? (
        <Animated.View style={{ height: '100%', width: '40%', borderRadius: height / 2, backgroundColor: c, transform: [{ translateX }] }} />
      ) : (
        <View style={{ height: '100%', width: `${Math.max(0, Math.min(100, value * 100))}%`, borderRadius: height / 2, backgroundColor: c }} />
      )}
    </View>
  );
}

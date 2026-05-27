import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { useTheme } from '../../theme';

const BARS = [0, 1, 2, 1];

// Small animated equalizer shown on the currently-playing book row.
export function PlayingPulse() {
  const { palette: p } = useTheme();
  const values = useRef(BARS.map(() => new Animated.Value(0.4))).current;

  useEffect(() => {
    const loops = values.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 120),
          Animated.timing(v, { toValue: 1, duration: 450, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.4, duration: 450, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [values]);

  return (
    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: p.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
      {BARS.map((d, i) => (
        <Animated.View
          key={i}
          style={{ width: 2, height: 8 + d * 4, borderRadius: 1, backgroundColor: p.onPrimary, transform: [{ scaleY: values[i] }] }}
        />
      ))}
    </View>
  );
}

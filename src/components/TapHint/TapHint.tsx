import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, Text } from 'react-native';
import { elevation, ty, TYPE, useTheme } from '../../theme';
import { Icon } from '../Icon';
import { makeStyles } from './TapHint.styles';

export type TapHintProps = { onClose?: () => void };

// Floating first-open hint. Pops in with a slight overshoot (a nudge toward the
// reader), and can be dismissed with the X (auto-dismiss + tap-to-dismiss are
// handled by the screen).
export function TapHint({ onClose }: TapHintProps) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();
  }, [scale, opacity]);

  return (
    <Animated.View style={[styles.hint, elevation(3), { opacity, transform: [{ scale }] }]}>
      <Icon name="highlight" size={16} color={p.background} />
      <Text style={[ty(TYPE.bodySmall, p.background), styles.label]}>Tap a sentence to start there, then press play</Text>
      <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Dismiss hint" style={styles.close}>
        <Icon name="close" size={15} color={p.background} />
      </Pressable>
    </Animated.View>
  );
}

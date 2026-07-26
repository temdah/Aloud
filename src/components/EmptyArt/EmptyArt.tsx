import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../../theme';
import { makeStyles } from './EmptyArt.styles';

// Cover palettes (kept in sync with BookCover's HUES).
const HUES = [
  { bg: '#d4bda1', stripe: '#a08362' },
  { bg: '#b8a890', stripe: '#7a6e5a' },
  { bg: '#a0a896', stripe: '#5e6757' },
  { bg: '#c79e8e', stripe: '#86604f' },
  { bg: '#a99cb3', stripe: '#695a73' },
  { bg: '#8e9da8', stripe: '#52606a' },
];

type CoverProps = {
  hue: { bg: string; stripe: string };
  x: number;
  y: number;
  w: number;
  h: number;
  // dx/dy: start offset from the final spot (cover begins stacked over the
  // middle book), animating to (0,0) as `anim` runs 0→1.
  dx: number;
  dy: number;
  rotFrom: number;
  rotTo: number;
  anim: Animated.Value;
  opacity: Animated.AnimatedInterpolation<number> | Animated.Value;
  borderStrong: string;
};

function AnimatedCover({ hue, x, y, w, h, dx, dy, rotFrom, rotTo, anim, opacity, borderStrong }: CoverProps) {
  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [dx, 0] });
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] });
  const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: [`${rotFrom}deg`, `${rotTo}deg`] });
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        opacity,
        transform: [{ translateX }, { translateY }, { rotate }],
        borderRadius: 4,
        backgroundColor: hue.bg,
        borderWidth: 1,
        borderColor: borderStrong,
        overflow: 'hidden',
        shadowColor: '#281e0f',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 14,
        elevation: 4,
      }}
    >
      <View style={{ position: 'absolute', left: 8, right: 8, top: 14, height: 3, borderRadius: 1, backgroundColor: hue.stripe, opacity: 0.6 }} />
      <View style={{ position: 'absolute', left: 8, right: 16, top: 22, height: 3, borderRadius: 1, backgroundColor: hue.stripe, opacity: 0.4 }} />
      <View style={{ position: 'absolute', left: 8, right: 24, top: 30, height: 3, borderRadius: 1, backgroundColor: hue.stripe, opacity: 0.3 }} />
    </Animated.View>
  );
}

// Empty-library hero. On mount the middle book fades in first, then the side
// books spread out from behind/in front of it (a quick ~0.9s reveal), and the
// dashed concentric rings fade in last.
export function EmptyArt() {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const mid = useRef(new Animated.Value(0)).current;
  const spread = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    mid.setValue(0);
    spread.setValue(0);
    Animated.parallel([
      Animated.timing(mid, { toValue: 1, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(200),
        Animated.timing(spread, { toValue: 1, duration: 640, easing: Easing.out(Easing.back(1.3)), useNativeDriver: true }),
      ]),
    ]).start();
  }, [mid, spread]);

  // Side covers fade in as soon as they start emerging; rings come in last.
  const sideOpacity = spread.interpolate({ inputRange: [0, 0.18, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' });
  const ringOpacity = spread.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1], extrapolate: 'clamp' });

  return (
    <View style={styles.container}>
      {/* Left cover — settles behind, tilted left. */}
      <AnimatedCover hue={HUES[4]} x={6} y={20} w={92} h={130} dx={60} dy={-9} rotFrom={0} rotTo={-9} anim={spread} opacity={sideOpacity} borderStrong={p.borderStrong} />
      {/* Middle cover — stays put, fades in first. */}
      <AnimatedCover hue={HUES[1]} x={66} y={6} w={92} h={140} dx={0} dy={0} rotFrom={3} rotTo={3} anim={spread} opacity={mid} borderStrong={p.borderStrong} />
      {/* Right cover — settles in front, tilted right. */}
      <AnimatedCover hue={HUES[3]} x={124} y={26} w={92} h={130} dx={-58} dy={-15} rotFrom={0} rotTo={11} anim={spread} opacity={sideOpacity} borderStrong={p.borderStrong} />
      <Animated.View style={[styles.svg, { opacity: ringOpacity }]} pointerEvents="none">
        <Svg viewBox="0 0 220 170" style={StyleSheet.absoluteFill}>
          {[0, 1, 2].map((i) => (
            <Circle key={i} cx={112} cy={80} r={50 + i * 14} fill="none" stroke={p.primary} strokeOpacity={0.18 - i * 0.05} strokeWidth={1} strokeDasharray="2 5" />
          ))}
        </Svg>
      </Animated.View>
    </View>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { ty, TYPE, useTheme } from '../../theme';
import { Button } from '../Button';
import { EmptyArt } from '../EmptyArt';
import { makeStyles } from './EmptyLibrary.styles';

const TITLE = 'A library that reads to you';
const SUBTITLE = 'Import a PDF, Markdown, or Word file and tap anywhere in the text. The voice picks up from there — fully offline.';

// Typewriter reveal. The full string is rendered transparent underneath to
// reserve its final layout, so the visible text doesn't reflow as it grows.
function Typewriter({
  text,
  delay,
  charMs,
  style,
  containerStyle,
}: {
  text: string;
  delay: number;
  charMs: number;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(0);
    let i = 0;
    let interval: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      interval = setInterval(() => {
        i += 1;
        setCount(i);
        if (i >= text.length && interval) clearInterval(interval);
      }, charMs);
    }, delay);
    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
    };
  }, [text, delay, charMs]);

  return (
    <View style={containerStyle}>
      <Text style={[style, { opacity: 0 }]}>{text}</Text>
      <Text style={[style, { position: 'absolute', left: 0, top: 0, textAlign: 'left' }]}>{text.slice(0, count)}</Text>
    </View>
  );
}

// Animated empty-library state: art spreads open, the title types out, subtitle
// fades in, then the import button pops in. The sequence lands inside ~1.8s.
export function EmptyLibrary({ onImport }: { onImport: () => void }) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);

  const subOpacity = useRef(new Animated.Value(0)).current;
  const subY = useRef(new Animated.Value(8)).current;
  const btnOpacity = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    subOpacity.setValue(0);
    subY.setValue(8);
    btnOpacity.setValue(0);
    btnScale.setValue(0.92);

    const sub = Animated.sequence([
      Animated.delay(880),
      Animated.parallel([
        Animated.timing(subOpacity, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(subY, { toValue: 0, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
    ]);

    const btn = Animated.sequence([
      Animated.delay(1120),
      Animated.parallel([
        Animated.timing(btnOpacity, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(btnScale, { toValue: 1, duration: 260, easing: Easing.out(Easing.back(2.2)), useNativeDriver: true }),
      ]),
      // Secondary bounce to signal it's pressable.
      Animated.delay(120),
      Animated.timing(btnScale, { toValue: 1.05, duration: 130, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(btnScale, { toValue: 1, duration: 280, easing: Easing.elastic(1.6), useNativeDriver: true }),
    ]);

    Animated.parallel([sub, btn]).start();
  }, [subOpacity, subY, btnOpacity, btnScale]);

  return (
    <View style={styles.body}>
      <EmptyArt />
      <Typewriter text={TITLE} delay={320} charMs={24} style={ty(TYPE.titleLarge, p.text)} containerStyle={styles.titleWrap} />
      <Animated.Text style={[ty(TYPE.body, p.textMuted), styles.subtitle, { opacity: subOpacity, transform: [{ translateY: subY }] }]}>
        {SUBTITLE}
      </Animated.Text>
      <Animated.View style={{ opacity: btnOpacity, transform: [{ scale: btnScale }] }}>
        <Button label="Import file" icon="import" size="lg" variant="filled" full onPress={onImport} />
      </Animated.View>
    </View>
  );
}

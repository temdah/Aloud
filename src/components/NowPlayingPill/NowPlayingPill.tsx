import { useMemo, useRef } from 'react';
import { Animated, PanResponder, Pressable, Text, View } from 'react-native';
import { elevation, ty, TYPE, useTheme } from '../../theme';
import type { Book } from '../../types';
import { CoverThumb } from '../CoverThumb';
import { Icon } from '../Icon';
import { makeStyles } from './NowPlayingPill.styles';

export type NowPlayingPillProps = {
  book: Book;
  playing?: boolean;
  onPress?: () => void;
  onToggle?: () => void;
  onStop?: () => void; // square stop: halt but keep the pill (resume on play)
  onDismiss?: () => void; // swipe away: full stop + forget the doc
};

const DISMISS_THRESHOLD = 110;

// Floating "now playing" bar. Swipe horizontally to dismiss; the square stops
// without dismissing (bar stays for resume).
export function NowPlayingPill({ book, playing = true, onPress, onToggle, onStop, onDismiss }: NowPlayingPillProps) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const responder = useMemo(
    () =>
      PanResponder.create({
        // Only claim a deliberate horizontal drag, so taps still reach the buttons.
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderMove: (_e, g) => {
          translateX.setValue(g.dx);
          opacity.setValue(Math.max(0.15, 1 - Math.abs(g.dx) / 280));
        },
        onPanResponderRelease: (_e, g) => {
          if (Math.abs(g.dx) > DISMISS_THRESHOLD) {
            Animated.timing(translateX, {
              toValue: g.dx > 0 ? 600 : -600,
              duration: 180,
              useNativeDriver: true,
            }).start(() => onDismiss?.());
          } else {
            Animated.parallel([
              Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
              Animated.spring(opacity, { toValue: 1, useNativeDriver: true }),
            ]).start();
          }
        },
      }),
    [translateX, opacity, onDismiss],
  );

  return (
    <Animated.View style={[styles.pill, elevation(3), { transform: [{ translateX }], opacity }]} {...responder.panHandlers}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${book.title}`} style={styles.tapZone}>
        <CoverThumb idx={book.cover} width={36} height={46} />
        <View style={styles.body}>
          <Text style={ty(TYPE.bodySmall, p.textMuted)}>Now playing</Text>
          <Text numberOfLines={1} style={ty(TYPE.label, p.text)}>{book.title}</Text>
        </View>
      </Pressable>
      {onStop ? (
        <Pressable onPress={onStop} accessibilityRole="button" accessibilityLabel="Stop" style={styles.stopButton} hitSlop={6}>
          <Icon name="stop" size={20} color={p.textMuted} />
        </Pressable>
      ) : null}
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityLabel={playing ? 'Pause' : 'Play'} style={styles.toggle}>
        <Icon name={playing ? 'pause' : 'play'} size={18} color={p.onPrimary} />
      </Pressable>
    </Animated.View>
  );
}

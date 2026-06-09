import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
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
  /** Whole-document progress (0..1) for the thin bar; omit to hide it. */
  progress?: number | null;
};

// Floating "now playing" bar above the library list.
export function NowPlayingPill({ book, playing = true, onPress, onToggle, progress = null }: NowPlayingPillProps) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const pct = progress == null ? null : Math.max(0, Math.min(1, progress)) * 100;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.pill, elevation(3)]}
    >
      <CoverThumb idx={book.cover} width={36} height={46} />
      <View style={styles.body}>
        <Text style={ty(TYPE.bodySmall, p.textMuted)}>Now playing</Text>
        <Text numberOfLines={1} style={ty(TYPE.label, p.text)}>{book.title}</Text>
      </View>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityLabel={playing ? 'Pause' : 'Play'} style={styles.toggle}>
        <Icon name={playing ? 'pause' : 'play'} size={18} color={p.onPrimary} />
      </Pressable>
      {pct == null ? null : (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` }]} />
        </View>
      )}
    </Pressable>
  );
}

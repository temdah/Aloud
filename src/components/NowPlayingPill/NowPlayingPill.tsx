import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { elevation, ty, TYPE, useTheme } from '../../theme';
import type { Book } from '../../types';
import { CoverThumb } from '../CoverThumb';
import { Icon } from '../Icon';
import { makeStyles } from './NowPlayingPill.styles';

export type NowPlayingPillProps = { book: Book; onPress?: () => void; onToggle?: () => void };

// Floating "now playing" bar above the library list.
export function NowPlayingPill({ book, onPress, onToggle }: NowPlayingPillProps) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
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
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityLabel="Pause" style={styles.toggle}>
        <Icon name="pause" size={18} color={p.onPrimary} />
      </Pressable>
    </Pressable>
  );
}

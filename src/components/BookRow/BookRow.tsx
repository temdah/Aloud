import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ty, TYPE, useTheme } from '../../theme';
import type { Book } from '../../types';
import { CoverThumb } from '../CoverThumb';
import { Icon } from '../Icon';
import { PlayingPulse } from '../PlayingPulse';
import { ProgressBar } from '../ProgressBar';
import { makeStyles } from './BookRow.styles';

export type BookRowProps = { book: Book; last?: boolean; onPress?: () => void; onLongPress?: () => void };

export function BookRow({ book, last = false, onPress, onLongPress }: BookRowProps) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={book.author ? `${book.title} by ${book.author}` : book.title}
      android_ripple={{ color: p.surfaceAlt }}
      style={[styles.base, { borderBottomWidth: last ? 0 : 1 }]}
    >
      <CoverThumb idx={book.cover} width={48} height={62} />
      <View style={styles.body}>
        <Text numberOfLines={1} style={ty(TYPE.titleSerif, p.text)}>{book.title}</Text>
        {book.author ? <Text numberOfLines={1} style={[ty(TYPE.bodySmall, p.textMuted), styles.author]}>{book.author}</Text> : null}
        <View style={styles.metaRow}>
          <View style={styles.progressWrap}>
            <ProgressBar value={book.progress} height={4} color={book.state === 'playing' ? p.primary : p.borderStrong} />
          </View>
          <Text style={ty(TYPE.caption, p.textDim)}>{book.eta}</Text>
        </View>
      </View>
      {book.state === 'playing' ? (
        <PlayingPulse />
      ) : book.state === 'done' ? (
        <Icon name="check" size={18} color={p.success} />
      ) : (
        <View style={styles.playCircle}>
          <Icon name="play" size={14} color={p.text} />
        </View>
      )}
    </Pressable>
  );
}

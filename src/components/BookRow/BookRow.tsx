import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ty, TYPE, useTheme } from '../../theme';
import type { Book } from '../../types';
import { CircularProgress } from '../CircularProgress';
import { CoverThumb } from '../CoverThumb';
import { Icon } from '../Icon';
import { PlayingPulse } from '../PlayingPulse';
import { ProgressBar } from '../ProgressBar';
import { makeStyles } from './BookRow.styles';

// Library list row: cover, title/author, progress, and a trailing indicator that
// shows audiobook-render progress, a playing pulse, or a play/done affordance.
export type BookRowAudiobook = { value: number; status: 'running' | 'done' | 'cancelled' | 'error' };

export type BookRowProps = {
  book: Book;
  favourite?: boolean;
  last?: boolean;
  audiobook?: BookRowAudiobook;
  onPress?: () => void;
  onLongPress?: () => void;
  onPlay?: () => void;
};

export function BookRow({ book, favourite = false, last = false, audiobook, onPress, onLongPress, onPlay }: BookRowProps) {
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
      <View style={styles.trailing}>
        {favourite ? <Icon name="star" size={15} color={p.primary} /> : null}
        {audiobook ? (
          audiobook.status === 'done' ? (
            <CircularProgress value={1} size={30} color={p.success}>
              <Icon name="check" size={14} color={p.success} />
            </CircularProgress>
          ) : (
            <CircularProgress
              value={audiobook.status === 'running' ? audiobook.value : audiobook.value || 0}
              size={30}
              color={audiobook.status === 'error' ? p.danger : p.primary}
            >
              <Icon name="download" size={13} color={p.textMuted} />
            </CircularProgress>
          )
        ) : book.state === 'playing' ? (
          <Pressable onPress={onPlay} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Pause ${book.title}`}>
            <PlayingPulse />
          </Pressable>
        ) : book.state === 'done' ? (
          <Icon name="check" size={18} color={p.success} />
        ) : (
          <Pressable
            onPress={onPlay}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Play ${book.title}`}
            style={styles.playCircle}
          >
            <Icon name="play" size={14} color={p.text} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

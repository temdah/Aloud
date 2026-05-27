import { Pressable, Text, View } from 'react-native';
import { ty, TYPE, useTheme } from '../../theme';
import { CoverThumb } from '../../components/CoverThumb';
import { Icon } from '../../components/Icon';
import { ProgressBar } from '../../components/ProgressBar';
import type { Book } from './libraryTypes';
import { PlayingPulse } from './PlayingPulse';

type BookRowProps = { book: Book; last?: boolean; onPress?: () => void };

export function BookRow({ book, last = false, onPress }: BookRowProps) {
  const { palette: p } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${book.title} by ${book.author}`}
      android_ripple={{ color: p.surfaceAlt }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 18, borderBottomWidth: last ? 0 : 1, borderBottomColor: p.border }}
    >
      <CoverThumb idx={book.cover} width={48} height={62} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={ty(TYPE.titleSerif, p.text)}>{book.title}</Text>
        <Text numberOfLines={1} style={[ty(TYPE.bodySmall, p.textMuted), { marginTop: 1 }]}>{book.author}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <View style={{ flex: 1, maxWidth: 100 }}>
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
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: p.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="play" size={14} color={p.text} />
        </View>
      )}
    </Pressable>
  );
}

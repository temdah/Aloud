import { Pressable, Text, View } from 'react-native';
import { elevation, ty, TYPE, useTheme } from '../../theme';
import { CoverThumb } from '../../components/CoverThumb';
import { Icon } from '../../components/Icon';
import type { Book } from './libraryTypes';

type NowPlayingPillProps = { book: Book; onPress?: () => void; onToggle?: () => void };

// Floating "now playing" bar above the library list.
export function NowPlayingPill({ book, onPress, onToggle }: NowPlayingPillProps) {
  const { palette: p } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        { position: 'absolute', left: 16, right: 16, bottom: 24, backgroundColor: p.surface, borderRadius: 16, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: p.border },
        elevation(3),
      ]}
    >
      <CoverThumb idx={book.cover} width={36} height={46} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={ty(TYPE.bodySmall, p.textMuted)}>Now playing</Text>
        <Text numberOfLines={1} style={ty(TYPE.label, p.text)}>{book.title}</Text>
      </View>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityLabel="Pause" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: p.primary, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="pause" size={18} color={p.onPrimary} />
      </Pressable>
    </Pressable>
  );
}

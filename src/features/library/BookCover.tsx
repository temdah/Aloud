import { View } from 'react-native';
import { useTheme } from '../../theme';

const HUES = [
  { bg: '#d4bda1', stripe: '#a08362' },
  { bg: '#b8a890', stripe: '#7a6e5a' },
  { bg: '#a0a896', stripe: '#5e6757' },
  { bg: '#c79e8e', stripe: '#86604f' },
  { bg: '#a99cb3', stripe: '#695a73' },
  { bg: '#8e9da8', stripe: '#52606a' },
];

type BookCoverProps = { idx?: number; x: number; y: number; rot: number; w?: number; h?: number };

// Tilted decorative book cover for the empty-state art.
export function BookCover({ idx = 0, x, y, rot, w = 92, h = 130 }: BookCoverProps) {
  const { palette: p } = useTheme();
  const c = HUES[idx % HUES.length];
  return (
    <View
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        transform: [{ rotate: `${rot}deg` }],
        borderRadius: 4,
        backgroundColor: c.bg,
        borderWidth: 1,
        borderColor: p.borderStrong,
        overflow: 'hidden',
        shadowColor: '#281e0f',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 14,
        elevation: 4,
      }}
    >
      <View style={{ position: 'absolute', left: 8, right: 8, top: 14, height: 3, borderRadius: 1, backgroundColor: c.stripe, opacity: 0.6 }} />
      <View style={{ position: 'absolute', left: 8, right: 16, top: 22, height: 3, borderRadius: 1, backgroundColor: c.stripe, opacity: 0.4 }} />
      <View style={{ position: 'absolute', left: 8, right: 24, top: 30, height: 3, borderRadius: 1, backgroundColor: c.stripe, opacity: 0.3 }} />
    </View>
  );
}

import { View } from 'react-native';
import { useTheme } from '../theme';
import type { CoverThumbProps } from './componentTypes';

const HUES = [
  { bg: '#d6c4a8', stripe: '#a8896b' },
  { bg: '#c2b8a3', stripe: '#7d7361' },
  { bg: '#a8b0a0', stripe: '#5e6657' },
  { bg: '#c9a89a', stripe: '#8a665a' },
  { bg: '#b8a8c2', stripe: '#6e607a' },
];

// Placeholder book cover (flat tint + a couple of stripes). Replace with the
// rendered PDF first page once available.
export function CoverThumb({ idx = 0, width = 44, height = 56 }: CoverThumbProps) {
  const { palette: p } = useTheme();
  const h = HUES[idx % HUES.length];
  return (
    <View style={{ width, height, borderRadius: 3, backgroundColor: h.bg, borderWidth: 1, borderColor: p.borderStrong, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', left: 4, right: 4, top: 6, height: 2, borderRadius: 1, backgroundColor: h.stripe, opacity: 0.5 }} />
      <View style={{ position: 'absolute', left: 4, right: 8, top: 11, height: 2, borderRadius: 1, backgroundColor: h.stripe, opacity: 0.35 }} />
    </View>
  );
}

import { View } from 'react-native';
import { coverHue, useTheme } from '../../theme';

export type CoverThumbProps = { idx?: number; width?: number; height?: number };

// Placeholder book cover (flat tint + a couple of stripes). Replace with the
// rendered PDF first page once available. Hue comes from the shared cover
// palette so it matches the media-notification accent for the same book.
export function CoverThumb({ idx = 0, width = 44, height = 56 }: CoverThumbProps) {
  const { palette: p } = useTheme();
  const h = coverHue(idx);
  return (
    <View style={{ width, height, borderRadius: 3, backgroundColor: h.bg, borderWidth: 1, borderColor: p.borderStrong, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', left: 4, right: 4, top: 6, height: 2, borderRadius: 1, backgroundColor: h.stripe, opacity: 0.5 }} />
      <View style={{ position: 'absolute', left: 4, right: 8, top: 11, height: 2, borderRadius: 1, backgroundColor: h.stripe, opacity: 0.35 }} />
    </View>
  );
}

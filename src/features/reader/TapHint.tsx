import { Text, View } from 'react-native';
import { elevation, ty, TYPE, useTheme } from '../../theme';
import { Icon } from '../../components/Icon';

// Floating hint shown on an idle reader before first playback.
export function TapHint() {
  const { palette: p } = useTheme();
  return (
    <View
      pointerEvents="none"
      style={[
        { position: 'absolute', left: 24, right: 24, bottom: 16, backgroundColor: p.text, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
        elevation(2),
      ]}
    >
      <Icon name="highlight" size={16} color={p.background} />
      <Text style={ty(TYPE.bodySmall, p.background)}>Tap any sentence to start reading from there</Text>
    </View>
  );
}

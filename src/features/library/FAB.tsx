import { Pressable, Text } from 'react-native';
import { elevation, ty, TYPE, useTheme } from '../../theme';
import { Icon } from '../../components/Icon';
import type { IconName } from '../../components/componentTypes';

type FABProps = { icon: IconName; label: string; onPress?: () => void };

// Floating action button (import PDF).
export function FAB({ icon, label, onPress }: FABProps) {
  const { palette: p } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        { position: 'absolute', right: 16, bottom: 90, height: 56, paddingHorizontal: 22, backgroundColor: p.primary, borderRadius: 28, flexDirection: 'row', alignItems: 'center', gap: 8 },
        elevation(3),
      ]}
    >
      <Icon name={icon} size={20} color={p.onPrimary} />
      <Text style={ty(TYPE.label, p.onPrimary)}>{label}</Text>
    </Pressable>
  );
}

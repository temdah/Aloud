import { Pressable, Text } from 'react-native';
import { ty, TYPE, useTheme } from '../theme';
import type { ChipProps } from './componentTypes';
import { Icon } from './Icon';

export function Chip({ label, selected = false, icon, onPress }: ChipProps) {
  const { palette: p } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 32,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: selected ? p.primarySoft : 'transparent',
        borderWidth: 1,
        borderColor: selected ? p.primary : p.border,
      }}
    >
      {icon ? <Icon name={icon} size={14} color={selected ? p.primary : p.textMuted} /> : null}
      <Text style={ty(TYPE.bodySmall, selected ? p.primary : p.text)}>{label}</Text>
    </Pressable>
  );
}

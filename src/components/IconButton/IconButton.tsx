import { Pressable } from 'react-native';
import { useTheme } from '../../theme';
import type { IconName } from '../../types';
import { Icon } from '../Icon';

export type IconButtonProps = {
  icon: IconName;
  onPress?: () => void;
  size?: number;
  variant?: 'ghost' | 'tonal';
  selected?: boolean;
  accessibilityLabel?: string;
};

export function IconButton({ icon, onPress, size = 40, variant = 'ghost', selected = false, accessibilityLabel }: IconButtonProps) {
  const { palette: p } = useTheme();
  const bg = selected ? p.primarySoft : variant === 'tonal' ? p.surfaceAlt : 'transparent';
  const fg = selected ? p.primary : p.text;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? icon}
      android_ripple={{ color: p.surfaceAlt, borderless: true, radius: size / 2 }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={icon} size={size === 40 ? 22 : 24} color={fg} />
    </Pressable>
  );
}

import { Pressable, Text } from 'react-native';
import { elevation, RADIUS, TYPE, useTheme } from '../../theme';
import type { IconName } from '../../types';
import { Icon } from '../Icon';
import { Spinner } from '../Spinner';

export type ButtonVariant = 'filled' | 'tonal' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonProps = {
  label?: string;
  icon?: IconName;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  full?: boolean;
};

const SIZES = {
  sm: { h: 36, px: 14, fs: 13, gap: 6, icon: 16, radius: RADIUS.md },
  md: { h: 48, px: 20, fs: 15, gap: 8, icon: 18, radius: RADIUS.md },
  lg: { h: 56, px: 24, fs: 16, gap: 10, icon: 20, radius: RADIUS.lg },
} as const;

export function Button({
  label, icon, onPress, variant = 'filled', size = 'md',
  disabled = false, loading = false, full = false,
}: ButtonProps) {
  const { palette: p } = useTheme();
  const s = SIZES[size];
  const variants = {
    filled: { bg: p.primary, fg: p.onPrimary, border: p.primary },
    tonal: { bg: p.primarySoft, fg: p.primary, border: p.primarySoft },
    ghost: { bg: 'transparent', fg: p.text, border: p.border },
    danger: { bg: p.danger, fg: '#fff', border: p.danger },
  }[variant];

  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={inactive ? undefined : onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          height: s.h,
          paddingHorizontal: s.px,
          backgroundColor: variants.bg,
          borderWidth: 1,
          borderColor: variants.border,
          borderRadius: s.radius,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: s.gap,
          opacity: disabled ? 0.4 : 1,
          alignSelf: full ? 'stretch' : 'flex-start',
          transform: [{ scale: pressed && !inactive ? 0.97 : 1 }],
        },
        variant === 'filled' && !disabled ? elevation(1) : null,
      ]}
    >
      {loading ? (
        <Spinner size={s.icon} color={variants.fg} />
      ) : (
        icon && <Icon name={icon} size={s.icon} color={variants.fg} />
      )}
      {label ? <Text style={[TYPE.label, { fontSize: s.fs, color: variants.fg }]}>{label}</Text> : null}
    </Pressable>
  );
}

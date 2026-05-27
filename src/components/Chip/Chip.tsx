import { useMemo } from 'react';
import { Pressable, Text } from 'react-native';
import { ty, TYPE, useTheme } from '../../theme';
import type { IconName } from '../../types';
import { Icon } from '../Icon';
import { makeStyles } from './Chip.styles';

export type ChipProps = {
  label: string;
  selected?: boolean;
  icon?: IconName;
  onPress?: () => void;
};

export function Chip({ label, selected = false, icon, onPress }: ChipProps) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.base,
        {
          backgroundColor: selected ? p.primarySoft : 'transparent',
          borderColor: selected ? p.primary : p.border,
        },
      ]}
    >
      {icon ? <Icon name={icon} size={14} color={selected ? p.primary : p.textMuted} /> : null}
      <Text style={ty(TYPE.bodySmall, selected ? p.primary : p.text)}>{label}</Text>
    </Pressable>
  );
}

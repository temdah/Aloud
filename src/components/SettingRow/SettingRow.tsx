import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ty, TYPE, useTheme } from '../../theme';
import type { IconName } from '../../types';
import { Icon } from '../Icon';
import { makeStyles } from './SettingRow.styles';

export type SettingRowProps = {
  icon: IconName;
  title: string;
  value?: string;
  subtitle?: string;
  onPress?: () => void;
};

export function SettingRow({ icon, title, value, subtitle, onPress }: SettingRowProps) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      android_ripple={{ color: p.surfaceAlt }}
      style={styles.row}
    >
      <View style={styles.iconWrap}>
        <Icon name={icon} size={20} color={p.primary} />
      </View>
      <View style={styles.body}>
        <Text style={ty(TYPE.bodyMedium, p.text)}>{title}</Text>
        {subtitle ? <Text style={[ty(TYPE.bodySmall, p.textMuted), styles.subtitle]}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={ty(TYPE.label, p.primary)}>{value}</Text> : null}
      <Icon name="chevR" size={18} color={p.textDim} />
    </Pressable>
  );
}

import { Pressable, Text, View } from 'react-native';
import { RADIUS, ty, TYPE, useTheme } from '../../theme';
import type { IconName } from '../../components/componentTypes';
import { Icon } from '../../components/Icon';

type SettingRowProps = {
  icon: IconName;
  title: string;
  value?: string;
  subtitle?: string;
  onPress?: () => void;
};

export function SettingRow({ icon, title, value, subtitle, onPress }: SettingRowProps) {
  const { palette: p } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      android_ripple={{ color: p.surfaceAlt }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, borderRadius: RADIUS.md, paddingVertical: 14, paddingHorizontal: 16 }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: p.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={20} color={p.primary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={ty(TYPE.bodyMedium, p.text)}>{title}</Text>
        {subtitle ? <Text style={[ty(TYPE.bodySmall, p.textMuted), { marginTop: 1 }]}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={ty(TYPE.label, p.primary)}>{value}</Text> : null}
      <Icon name="chevR" size={18} color={p.textDim} />
    </Pressable>
  );
}

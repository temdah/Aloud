import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { ty, TYPE, useTheme } from '../../theme';

type SettingsSectionProps = { title: string; children: ReactNode };

export function SettingsSection({ title, children }: SettingsSectionProps) {
  const { palette: p } = useTheme();
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={[ty(TYPE.overline, p.textMuted), { paddingHorizontal: 4, paddingBottom: 8 }]}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

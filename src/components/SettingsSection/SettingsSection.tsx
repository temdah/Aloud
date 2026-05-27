import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { ty, TYPE, useTheme } from '../../theme';
import { makeStyles } from './SettingsSection.styles';

export type SettingsSectionProps = { title: string; children: ReactNode };

export function SettingsSection({ title, children }: SettingsSectionProps) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  return (
    <View style={styles.container}>
      <Text style={[ty(TYPE.overline, p.textMuted), styles.title]}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

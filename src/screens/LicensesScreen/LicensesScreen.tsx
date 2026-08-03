import { useNavigation } from '@react-navigation/native';
import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AppBar, SettingsSection } from '../../components';
import { ty, TYPE, useTheme } from '../../theme';
import type { AppNavigation } from '../../navigation';
import { LICENSE_SECTIONS } from './licenseData';
import { makeStyles } from './LicensesScreen.styles';

export default function LicensesScreen() {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const navigation = useNavigation<AppNavigation>();

  return (
    <View style={styles.screen}>
      <AppBar onBack={() => navigation.goBack()} title="Open-source licenses" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[ty(TYPE.body, p.textMuted), styles.intro]}>
          This app is built with the following open-source components, used under their respective licenses.
        </Text>
        {LICENSE_SECTIONS.map((section) => (
          <SettingsSection key={section.title} title={section.title}>
            {section.entries.map((e, i) => (
              <View key={e.name} style={[styles.entry, { borderTopWidth: i === 0 ? 0 : 1 }]}>
                <Text style={ty(TYPE.bodyMedium, p.text)}>{e.name}</Text>
                <Text style={[ty(TYPE.bodySmall, p.primary), styles.license]}>{e.license}</Text>
                {e.note ? <Text style={[ty(TYPE.caption, p.textDim), styles.note]}>{e.note}</Text> : null}
              </View>
            ))}
          </SettingsSection>
        ))}
      </ScrollView>
    </View>
  );
}

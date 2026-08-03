import { useNavigation } from '@react-navigation/native';
import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AppBar } from '../../components';
import { ty, TYPE, useTheme } from '../../theme';
import type { AppNavigation } from '../../navigation';
import { PRIVACY_INTRO, PRIVACY_SECTIONS, PRIVACY_UPDATED } from './privacyData';
import { makeStyles } from './PrivacyScreen.styles';

export default function PrivacyScreen() {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const navigation = useNavigation<AppNavigation>();

  return (
    <View style={styles.screen}>
      <AppBar onBack={() => navigation.goBack()} title="Privacy policy" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[ty(TYPE.body, p.textMuted), styles.intro]}>{PRIVACY_INTRO}</Text>
        <Text style={[ty(TYPE.caption, p.textDim), styles.updated]}>Last updated {PRIVACY_UPDATED}</Text>
        {PRIVACY_SECTIONS.map((s) => (
          <View key={s.title} style={styles.section}>
            <Text style={[ty(TYPE.bodyMedium, p.text), styles.sectionTitle]}>{s.title}</Text>
            {s.paragraphs.map((para, i) => (
              <Text key={i} style={[ty(TYPE.body, p.textMuted), styles.para]}>
                {para}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

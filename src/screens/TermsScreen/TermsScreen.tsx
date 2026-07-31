import { useNavigation } from '@react-navigation/native';
import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AppBar } from '../../components';
import { ty, TYPE, useTheme } from '../../theme';
import type { AppNavigation } from '../../navigation/navigationTypes';
import { TERMS_INTRO, TERMS_SECTIONS, TERMS_UPDATED } from './termsData';
import { makeStyles } from './TermsScreen.styles';

export default function TermsScreen() {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const navigation = useNavigation<AppNavigation>();

  return (
    <View style={styles.screen}>
      <AppBar onBack={() => navigation.goBack()} title="Terms of use" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[ty(TYPE.body, p.textMuted), styles.intro]}>{TERMS_INTRO}</Text>
        <Text style={[ty(TYPE.caption, p.textDim), styles.updated]}>Last updated {TERMS_UPDATED}</Text>
        {TERMS_SECTIONS.map((s) => (
          <View key={s.title} style={styles.section}>
            <Text style={[ty(TYPE.bodyMedium, p.text), styles.sectionTitle]}>{s.title}</Text>
            {s.paragraphs?.map((para, i) => (
              <Text key={i} style={[ty(TYPE.body, p.textMuted), styles.para]}>
                {para}
              </Text>
            ))}
            {s.bullets?.map((b, i) => (
              <View key={i} style={styles.bulletRow}>
                <Text style={[ty(TYPE.body, p.textMuted), styles.bulletDot]}>•</Text>
                <Text style={[ty(TYPE.body, p.textMuted), styles.bulletText]}>{b}</Text>
              </View>
            ))}
            {s.footer ? <Text style={[ty(TYPE.body, p.textMuted), styles.para]}>{s.footer}</Text> : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

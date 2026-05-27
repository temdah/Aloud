import { useNavigation } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AppBar, Icon, ListItem, Sheet, Slider, SettingRow, SettingsSection, VoicePicker, voiceLabel } from '../../components';
import { findModel } from '../../supertonic';
import { useSettingsStore } from '../../stores';
import { ty, TYPE, useTheme } from '../../theme';
import type { AppNavigation } from '../../navigation/navigationTypes';
import { makeStyles } from './SettingsScreen.styles';

export default function SettingsScreen() {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const navigation = useNavigation<AppNavigation>();

  const modelId = useSettingsStore((s) => s.modelId);
  const voice = useSettingsStore((s) => s.voiceId);
  const setVoice = useSettingsStore((s) => s.setVoice);
  const speed = useSettingsStore((s) => s.speed);
  const setSpeed = useSettingsStore((s) => s.setSpeed);
  const steps = useSettingsStore((s) => s.steps);
  const setSteps = useSettingsStore((s) => s.setSteps);

  const [voiceSheet, setVoiceSheet] = useState(false);

  const activeModel = findModel(modelId);

  return (
    <View style={styles.screen}>
      <AppBar onBack={() => navigation.goBack()} title="Playback" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <SettingsSection title="Voice">
          <SettingRow icon="voice" title="Reading voice" value={voiceLabel(voice)} onPress={() => setVoiceSheet(true)} />
        </SettingsSection>

        <SettingsSection title="Playback">
          <View style={styles.speedCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={ty(TYPE.bodyMedium, p.text)}>Speed</Text>
              <Text style={ty(TYPE.title, p.primary)}>×{speed.toFixed(2)}</Text>
            </View>
            <View style={styles.sliderWrap}>
              <Slider value={speed} min={0.9} max={1.5} step={0.05} onChange={setSpeed} ticks={[0.9, 1.0, 1.05, 1.25, 1.5]} />
            </View>
            <View style={styles.labelRow}>
              <Text style={ty(TYPE.mono, p.textDim)}>0.90</Text>
              <Text style={ty(TYPE.mono, p.textDim)}>default 1.05</Text>
              <Text style={ty(TYPE.mono, p.textDim)}>1.50</Text>
            </View>
          </View>

          <View style={styles.spacer} />

          <View style={styles.qualityCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={ty(TYPE.bodyMedium, p.text)}>Quality vs. speed</Text>
              <Text style={ty(TYPE.mono, p.textMuted)}>{steps} steps</Text>
            </View>
            <Text style={[ty(TYPE.bodySmall, p.textMuted), styles.qualityHint]}>
              Fewer inference steps render faster but rougher. More steps smooth out prosody at a small CPU cost.
            </Text>
            <View style={styles.qualitySliderWrap}>
              <Slider value={steps} min={4} max={32} step={2} onChange={(v) => setSteps(Math.round(v))} ticks={[4, 8, 16, 24, 32]} />
            </View>
            <View style={styles.labelRow}>
              <Text style={ty(TYPE.mono, p.textDim)}>Fast</Text>
              <Text style={ty(TYPE.mono, p.textDim)}>Balanced</Text>
              <Text style={ty(TYPE.mono, p.textDim)}>High</Text>
            </View>
          </View>
        </SettingsSection>

        <SettingsSection title="Models & storage">
          <View style={styles.storageCard}>
            <ListItem
              leading={<View style={styles.leadingPrimary}><Icon name="download" size={18} color={p.primary} /></View>}
              title="Voice model"
              subtitle={activeModel ? `${activeModel.label} · in use` : 'Not set — choose a model'}
              trailing={activeModel ? <Icon name="check" size={18} color={p.success} /> : <Icon name="chevR" size={18} color={p.textDim} />}
              onPress={() => navigation.navigate('VoiceModel')}
            />
            <ListItem
              divider={false}
              leading={<View style={styles.leadingMuted}><Icon name="trash" size={16} color={p.textMuted} /></View>}
              title="Clear cached audio"
              subtitle="No cached audio"
              trailing={<Icon name="chevR" size={18} color={p.textDim} />}
            />
          </View>
        </SettingsSection>

        <SettingsSection title="About">
          <View style={styles.storageCard}>
            <ListItem
              divider={false}
              leading={<View style={styles.leadingMuted}><Icon name="book" size={16} color={p.textMuted} /></View>}
              title="Open-source licenses"
              subtitle="Supertonic, PDF.js, fonts & libraries"
              trailing={<Icon name="chevR" size={18} color={p.textDim} />}
              onPress={() => navigation.navigate('Licenses')}
            />
          </View>
        </SettingsSection>

        <SettingsSection title="Developer">
          <View style={styles.storageCard}>
            <ListItem
              divider={false}
              leading={<View style={styles.leadingMuted}><Icon name="voice" size={16} color={p.textMuted} /></View>}
              title="Voice engine diagnostics"
              subtitle="Synthesize a test phrase"
              trailing={<Icon name="chevR" size={18} color={p.textDim} />}
              onPress={() => navigation.navigate('TextToSpeechDemo')}
            />
          </View>
        </SettingsSection>
      </ScrollView>

      <Sheet open={voiceSheet} onClose={() => setVoiceSheet(false)} title="Reading voice" heightRatio={0.78}>
        <VoicePicker value={voice} onChange={setVoice} />
      </Sheet>
    </View>
  );
}

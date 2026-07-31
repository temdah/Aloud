import { useNavigation } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { AppBar, Icon, LanguagePicker, ListItem, Sheet, Slider, SettingRow, SettingsSection, VoicePicker, voiceLabel } from '../../components';
import { documentCacheStats, findModel, languageLabel, QUALITY_LABELS, type Quality } from '../../supertonic';
import { useDocumentsStore, useSettingsStore } from '../../stores';
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
  const lang = useSettingsStore((s) => s.lang);
  const setLang = useSettingsStore((s) => s.setLang);
  const speed = useSettingsStore((s) => s.speed);
  const setSpeed = useSettingsStore((s) => s.setSpeed);
  const steps = useSettingsStore((s) => s.steps);
  const setSteps = useSettingsStore((s) => s.setSteps);
  const quality = useSettingsStore((s) => s.quality);
  const setQuality = useSettingsStore((s) => s.setQuality);

  const documents = useDocumentsStore((s) => s.documents);

  const [voiceSheet, setVoiceSheet] = useState(false);
  const [langSheet, setLangSheet] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const activeModel = findModel(modelId);

  // Total cached audio across every document, for the "Cached audio" subtitle.
  const cacheTotal = useMemo(() => {
    let count = 0;
    let bytes = 0;
    for (const d of documents) {
      const s = documentCacheStats(d.docHash);
      count += s.count;
      bytes += s.bytes;
    }
    return { count, bytes };
  }, [documents]);
  const cacheLabel =
    cacheTotal.bytes <= 0
      ? 'No cached audio'
      : cacheTotal.bytes < 1024 * 1024
        ? `${Math.max(1, Math.round(cacheTotal.bytes / 1024))} KB across ${cacheTotal.count} clip${cacheTotal.count === 1 ? '' : 's'}`
        : `${(cacheTotal.bytes / (1024 * 1024)).toFixed(cacheTotal.bytes < 10 * 1024 * 1024 ? 1 : 0)} MB across ${cacheTotal.count} clips`;

  return (
    <View style={styles.screen}>
      <AppBar onBack={() => navigation.goBack()} title="Playback" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <SettingsSection title="Voice">
          <SettingRow icon="voice" title="Reading voice" value={voiceLabel(voice)} onPress={() => setVoiceSheet(true)} />
          <SettingRow
            icon="book"
            title="Language"
            value={languageLabel(lang)}
            onPress={() => (activeModel ? setLangSheet(true) : navigation.navigate('VoiceModel'))}
          />
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

          <Text style={[ty(TYPE.label, p.textMuted), styles.groupLabel]}>Quality</Text>
          <View style={styles.storageCard}>
            {(['fast', 'balanced', 'quality'] as Quality[]).map((q, i) => {
              const label = QUALITY_LABELS[q];
              const selected = quality === q;
              return (
                <Pressable
                  key={q}
                  onPress={() => setQuality(q)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[
                    styles.presetRow,
                    { backgroundColor: selected ? p.primarySoft : 'transparent', borderBottomWidth: i === 2 ? 0 : 1 },
                  ]}
                >
                  <View style={styles.presetBody}>
                    <Text style={ty(TYPE.bodyMedium, p.text)}>{label.title}</Text>
                    <Text style={ty(TYPE.bodySmall, p.textMuted)}>{label.subtitle}</Text>
                  </View>
                  {selected ? <Icon name="check" size={20} color={p.primary} /> : null}
                </Pressable>
              );
            })}
          </View>

          <Pressable onPress={() => setAdvancedOpen((o) => !o)} accessibilityRole="button" style={styles.advancedToggle}>
            <Text style={ty(TYPE.label, p.textMuted)}>Advanced</Text>
            <View style={{ transform: [{ rotate: advancedOpen ? '90deg' : '0deg' }] }}>
              <Icon name="chevR" size={16} color={p.textDim} />
            </View>
          </Pressable>
          {advancedOpen ? (
            <View style={styles.qualityCard}>
              <View style={styles.cardHeaderRow}>
                <Text style={ty(TYPE.bodyMedium, p.text)}>Quality steps</Text>
                <Text style={ty(TYPE.mono, p.textMuted)}>{steps} steps</Text>
              </View>
              <Text style={[ty(TYPE.bodySmall, p.textMuted), styles.qualityHint]}>
                Fewer steps generate each clip faster; more sound smoother but start later. The presets above set this for you.
              </Text>
              <View style={styles.qualitySliderWrap}>
                <Slider value={steps} min={4} max={16} step={1} onChange={(v) => setSteps(Math.round(v))} ticks={[4, 5, 8, 12, 16]} />
              </View>
              <View style={styles.labelRow}>
                <Text style={ty(TYPE.mono, p.textDim)}>Faster</Text>
                <Text style={ty(TYPE.mono, p.textDim)}>Smoother</Text>
              </View>
            </View>
          ) : null}
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
              title="Cached audio"
              subtitle={cacheLabel}
              trailing={<Icon name="chevR" size={18} color={p.textDim} />}
              onPress={() => navigation.navigate('Storage')}
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
              subtitle="Synthesis performance benchmarks"
              trailing={<Icon name="chevR" size={18} color={p.textDim} />}
              onPress={() => navigation.navigate('TextToSpeechDemo')}
            />
          </View>
        </SettingsSection>
      </ScrollView>

      <Sheet open={voiceSheet} onClose={() => setVoiceSheet(false)} title="Reading voice" heightRatio={0.78}>
        <VoicePicker value={voice} onChange={setVoice} modelId={modelId} lang={lang} />
      </Sheet>

      <Sheet open={langSheet} onClose={() => setLangSheet(false)} title="Language" heightRatio={0.78}>
        <LanguagePicker
          value={lang}
          onChange={(code) => {
            setLang(code);
            setLangSheet(false);
          }}
          langCodes={activeModel?.langCodes ?? []}
        />
      </Sheet>
    </View>
  );
}

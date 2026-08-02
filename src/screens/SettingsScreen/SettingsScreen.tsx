import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { ActionDialog, AppBar, Chip, Icon, LanguagePicker, ListItem, Sheet, SettingRow, SettingsSection, VoicePicker, voiceLabel } from '../../components';
import { documentCacheStats, findModel, languageLabel, NARRATION_TONE_LABELS, QUALITY_LABELS, type Quality } from '../../supertonic';
import { useDocumentsStore, useSettingsStore } from '../../stores';
import { ty, TYPE, useTheme } from '../../theme';
import type { NarrationTone } from '../../types';
import type { AppNavigation } from '../../navigation/navigationTypes';
import { makeStyles } from './SettingsScreen.styles';

const SPEED_PRESETS = [0.9, 1.0, 1.05, 1.25, 1.5];
const DEFAULT_SPEED = 1.05;
const STEP_PRESETS = [5, 6, 8, 10];
const TONE_OPTIONS: NarrationTone[] = ['adaptive', 'neutral', 'expressive', 'happy', 'sad', 'scared'];

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
  const tone = useSettingsStore((s) => s.tone);
  const setTone = useSettingsStore((s) => s.setTone);
  const keepEngineWarm = useSettingsStore((s) => s.keepEngineWarm);
  const setKeepEngineWarm = useSettingsStore((s) => s.setKeepEngineWarm);

  const documents = useDocumentsStore((s) => s.documents);

  const [voiceSheet, setVoiceSheet] = useState(false);
  const [langSheet, setLangSheet] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [pendingQuality, setPendingQuality] = useState<Quality | null>(null);

  const activeModel = findModel(modelId);

  // Re-scan the on-disk cache each time the screen regains focus, so deleting
  // audio in the Storage screen is reflected here on return.
  const [cacheVersion, setCacheVersion] = useState(0);
  useFocusEffect(useCallback(() => setCacheVersion((v) => v + 1), []));

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents, cacheVersion]);
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
            <Text style={[ty(TYPE.bodySmall, p.textMuted), styles.qualityHint]}>How fast the voice reads. Default is ×1.05.</Text>
            <View style={styles.chipRow}>
              {SPEED_PRESETS.map((v) => (
                <Chip
                  key={v}
                  label={v === DEFAULT_SPEED ? `×${v.toFixed(2)} · default` : `×${v.toFixed(2)}`}
                  selected={Math.abs(speed - v) < 0.001}
                  onPress={() => setSpeed(v)}
                />
              ))}
            </View>
          </View>

          <View style={styles.spacer} />

          <Text style={[ty(TYPE.label, p.textMuted), styles.groupLabel]}>Tone</Text>
          <Text style={[ty(TYPE.bodySmall, p.textMuted), styles.groupHint]}>
            Adaptive reads academic text neutrally and varies story pacing from the words it finds.
          </Text>
          <View style={styles.qualityCard}>
            <View style={styles.chipRow}>
              {TONE_OPTIONS.map((value) => (
                <Chip
                  key={value}
                  label={NARRATION_TONE_LABELS[value].title}
                  selected={tone === value}
                  onPress={() => setTone(value)}
                />
              ))}
            </View>
            <Text style={[ty(TYPE.bodySmall, p.textMuted), styles.qualityHint]}>
              {NARRATION_TONE_LABELS[tone].subtitle}
            </Text>
          </View>

          <View style={styles.spacer} />

          <Text style={[ty(TYPE.label, p.textMuted), styles.groupLabel]}>Quality</Text>
          <Text style={[ty(TYPE.bodySmall, p.textMuted), styles.groupHint]}>How natural the voice sounds versus how fast it starts.</Text>
          <View style={styles.storageCard}>
            {(['fast', 'balanced', 'quality'] as Quality[]).map((q, i) => {
              const label = QUALITY_LABELS[q];
              const selected = quality === q;
              return (
                <Pressable
                  key={q}
                  onPress={() => {
                    if (q === quality) return;
                    // Changing quality re-chunks docs; warn if that would clear cached audio.
                    if (cacheTotal.bytes > 0) setPendingQuality(q);
                    else setQuality(q);
                  }}
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
                Five is the minimum because lower values noticeably reduce voice quality. More steps sound smoother but start later.
              </Text>
              <View style={styles.chipRow}>
                {STEP_PRESETS.map((v) => (
                  <Chip key={v} label={`${v}`} selected={steps === v} onPress={() => setSteps(v)} />
                ))}
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
              leading={<View style={styles.leadingMuted}><Icon name="trash" size={16} color={p.textMuted} /></View>}
              title="Cached audio"
              subtitle={cacheLabel}
              trailing={<Icon name="chevR" size={18} color={p.textDim} />}
              onPress={() => navigation.navigate('Storage')}
            />
            <ListItem
              divider={false}
              leading={<View style={styles.leadingMuted}><Icon name="voice" size={16} color={p.textMuted} /></View>}
              title="Keep voice engine ready"
              subtitle="Instant playback. Turn off to free memory on low-RAM devices."
              trailing={
                <Switch
                  value={keepEngineWarm}
                  onValueChange={setKeepEngineWarm}
                  trackColor={{ true: p.primary, false: p.border }}
                  thumbColor={p.surface}
                />
              }
              onPress={() => setKeepEngineWarm(!keepEngineWarm)}
            />
          </View>
        </SettingsSection>

        <SettingsSection title="About">
          <View style={styles.storageCard}>
            <ListItem
              leading={<View style={styles.leadingMuted}><Icon name="book" size={16} color={p.textMuted} /></View>}
              title="Terms of use"
              subtitle="Personal, non-commercial use"
              trailing={<Icon name="chevR" size={18} color={p.textDim} />}
              onPress={() => navigation.navigate('Terms')}
            />
            <ListItem
              leading={<View style={styles.leadingMuted}><Icon name="book" size={16} color={p.textMuted} /></View>}
              title="Privacy policy"
              subtitle="No data collected — fully offline"
              trailing={<Icon name="chevR" size={18} color={p.textDim} />}
              onPress={() => navigation.navigate('Privacy')}
            />
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

      <ActionDialog
        open={pendingQuality !== null}
        onClose={() => setPendingQuality(null)}
        title="Change playback quality?"
        message="This re-chunks your documents, so their cached audio is regenerated. Full audiobooks you've saved are kept; other cached clips are cleared and re-made as you listen."
        actions={[
          { label: 'Change', variant: 'filled', onPress: () => pendingQuality && setQuality(pendingQuality) },
          { label: 'Cancel', variant: 'ghost' },
        ]}
      />
    </View>
  );
}

import { useNavigation } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, EmptyArt, Icon, ModelCard } from '../../components';
import { useImportDocument } from '../../hooks';
import { useSettingsStore } from '../../stores';
import { MODELS, QUALITY_LABELS, type Quality } from '../../supertonic';
import { ty, TYPE, useTheme } from '../../theme';
import type { AppNavigation } from '../../navigation';
import type { OnboardingStep } from './OnboardingScreenTypes';
import { makeStyles } from './OnboardingScreen.styles';

// First-run wizard: model-first, so the app never ambushes the user with a model
// download the moment they press play. Welcome → download + choose a voice →
// import the first document. Gated on `onboarded`, which it sets on completion.
export default function OnboardingScreen() {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<AppNavigation>();

  const modelId = useSettingsStore((s) => s.modelId);
  const setModelId = useSettingsStore((s) => s.setModelId);
  const voiceId = useSettingsStore((s) => s.voiceId);
  const quality = useSettingsStore((s) => s.quality);
  const setQuality = useSettingsStore((s) => s.setQuality);
  const setOnboarded = useSettingsStore((s) => s.setOnboarded);
  const acceptTerms = useSettingsStore((s) => s.acceptTerms);
  const { importDocument, importing } = useImportDocument();
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [agreed, setAgreed] = useState(false);

  const finish = (docId?: string) => {
    setOnboarded(true);
    // One atomic reset that replaces the whole stack — a reset-then-navigate pair
    // races and can leave Onboarding under the Reader, so back-ing out returns
    // here instead of the library.
    navigation.reset(
      docId
        ? { index: 1, routes: [{ name: 'Library' }, { name: 'Reader', params: { docId } }] }
        : { index: 0, routes: [{ name: 'Library' }] },
    );
  };

  const onImport = async () => {
    const doc = await importDocument();
    if (doc) finish(doc.docHash); // cancelled picker → stay so they can retry or skip
  };

  const pad = { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 };

  if (step === 'model') {
    return (
      <View style={[styles.screen, pad]}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[ty(TYPE.title, p.text), styles.stepTitle]}>Choose a voice</Text>
          <Text style={[ty(TYPE.body, p.textMuted), styles.stepIntro]}>
            Download a voice engine to read your documents. It runs entirely on your device — you can add the other or switch anytime in Settings.
          </Text>
          {MODELS.map((m) => (
            <ModelCard
              key={m.id}
              model={m}
              voiceId={voiceId}
              active={modelId === m.id}
              onUse={() => setModelId(m.id)}
              onDeleted={() => {
                if (modelId === m.id) setModelId(null);
              }}
            />
          ))}
        </ScrollView>
        <View style={styles.footer}>
          <Button label="Continue" icon="chevR" size="lg" variant="filled" full disabled={!modelId} onPress={() => setStep('quality')} />
          <Text style={[ty(TYPE.caption, p.textDim), styles.hint]}>
            {modelId ? 'Voice ready' : 'Download a voice, then tap “Use this model” to continue'}
          </Text>
        </View>
      </View>
    );
  }

  if (step === 'quality') {
    return (
      <View style={[styles.screen, pad]}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[ty(TYPE.title, p.text), styles.stepTitle]}>How should it sound?</Text>
          <Text style={[ty(TYPE.body, p.textMuted), styles.stepIntro]}>
            Higher quality is smoother but needs a faster phone; Faster starts quicker. You can change this anytime in Settings.
          </Text>
          <View style={styles.presetCard}>
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
                    { backgroundColor: selected ? p.primarySoft : 'transparent', borderBottomWidth: i === 2 ? 0 : 1, borderBottomColor: p.border },
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
        </ScrollView>
        <View style={styles.footer}>
          <Button label="Continue" icon="chevR" size="lg" variant="filled" full onPress={() => setStep('ready')} />
        </View>
      </View>
    );
  }

  if (step === 'ready') {
    return (
      <View style={[styles.screen, pad]}>
        <View style={styles.hero}>
          <View style={styles.readyBadge}>
            <Icon name="check" size={40} color={p.success} />
          </View>
        </View>
        <View style={styles.copy}>
          <Text style={ty(TYPE.title, p.text)}>You’re all set</Text>
          <Text style={[ty(TYPE.body, p.textMuted), styles.lead]}>
            Import a document and press play — or tap any sentence to start there.
          </Text>
        </View>
        <View style={styles.footer}>
          <Button label="Import a document" icon="import" size="lg" variant="filled" full loading={importing} onPress={() => void onImport()} />
          <Button label="Go to library" variant="ghost" full onPress={() => finish()} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, pad]}>
      <View style={styles.hero}>
        <EmptyArt />
      </View>
      <View style={styles.copy}>
        <Text style={ty(TYPE.display, p.text)}>Aloud</Text>
        <Text style={[ty(TYPE.body, p.textMuted), styles.lead]}>
          A natural on-device voice that reads your PDFs, Markdown, and Word files aloud — fully offline. Nothing leaves your phone.
        </Text>
      </View>
      <View style={styles.footer}>
        <View style={styles.consentRow}>
          <Pressable
            onPress={() => setAgreed((a) => !a)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreed }}
            hitSlop={8}
            style={[styles.checkbox, agreed && styles.checkboxOn]}
          >
            {agreed ? <Icon name="check" size={13} color={p.onPrimary} /> : null}
          </Pressable>
          <Text style={[ty(TYPE.bodySmall, p.textMuted), styles.consentText]}>
            I agree to the{' '}
            <Text style={ty(TYPE.bodySmall, p.primary)} onPress={() => navigation.navigate('Terms')}>Terms</Text>
            {' '}and{' '}
            <Text style={ty(TYPE.bodySmall, p.primary)} onPress={() => navigation.navigate('Privacy')}>Privacy policy</Text>
            {' '}— personal, non-commercial use only.
          </Text>
        </View>
        <Button
          label="Get started"
          icon="chevR"
          size="lg"
          variant="filled"
          full
          disabled={!agreed}
          onPress={() => {
            acceptTerms();
            setStep('model');
          }}
        />
      </View>
    </View>
  );
}

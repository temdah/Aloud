import { useNavigation, useRoute } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ActionDialog, AppBar, Button, Chip, Icon, ProgressBar, Sheet, Spinner, VoicePicker, voiceLabel } from '../../components';
import { usePdfText, usePrerender } from '../../hooks';
import { usePlaybackContext } from '../../playback';
import { useDocumentsStore, useSettingsStore } from '../../stores';
import { areModelsDownloaded, languageLabel, loadChunks, MODELS, qualityProfile, readManifest, settingsHash } from '../../supertonic';
import type { ModelInfo, NarrationSettings } from '../../supertonic';
import type { Chunk } from '../../types';
import { ty, TYPE, useTheme } from '../../theme';
import type { AppNavigation, PrerenderRoute } from '../../navigation/navigationTypes';
import { makeStyles } from './PrerenderScreen.styles';

const SPEED_PRESETS = [0.9, 1.0, 1.05, 1.25, 1.5];
// Rough spoken rate (chars/sec at ×1.0) — only used for the size/time estimate.
const CHARS_PER_SEC = 14;
// Cache is AAC-LC mono at 64 kbps (see aac-codec) → 8000 bytes/s.
const AAC_BYTES_PER_SEC = 64000 / 8;

function pickInitialModel(modelId: string | null, voiceId: string): ModelInfo {
  if (modelId) {
    const m = MODELS.find((x) => x.id === modelId);
    if (m) return m;
  }
  return MODELS.find((m) => areModelsDownloaded(m.id, voiceId)) ?? MODELS[0];
}

// "Process entire book" → pre-render every chunk so playback never waits. The
// user picks quality (model), voice, language and speed; the chosen profile is
// pinned to the document so the reader's tap-to-start reads the same cache.
export default function PrerenderScreen() {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const navigation = useNavigation<AppNavigation>();
  const route = useRoute<PrerenderRoute>();
  const docId = route.params.docId;

  const doc = useDocumentsStore((s) => s.documents.find((d) => d.docHash === docId));
  const setRenderProfile = useDocumentsStore((s) => s.setRenderProfile);
  const audiobook = useDocumentsStore((s) => s.audiobook[docId]);
  const defaultModelId = useSettingsStore((s) => s.modelId);
  const defaultVoice = useSettingsStore((s) => s.voiceId);
  const defaultSpeed = useSettingsStore((s) => s.speed);
  const steps = useSettingsStore((s) => s.steps);
  const unitLen = useSettingsStore((s) => qualityProfile(s.quality).unitLen);

  // Prepare the book's text headlessly (the hidden extractor below streams pages
  // and writes the caches); no need to open the reader first.
  const pdfText = usePdfText(doc);
  // Derive chunks from the ready text via idempotent loadChunks (reuses a valid
  // manifest, else rebuilds). Rebuilding here un-sticks the case where the text
  // was cached but the chunk manifest went missing. Still extracting → read the
  // manifest as-is.
  const chunks = useMemo<Chunk[]>(() => {
    if (pdfText.status === 'ready' && pdfText.document) {
      try {
        return loadChunks(docId, pdfText.document.text, unitLen);
      } catch {
        return [];
      }
    }
    return readManifest(docId)?.chunks ?? [];
  }, [docId, pdfText.status, pdfText.document, unitLen]);

  const [model, setModel] = useState<ModelInfo>(() => pickInitialModel(defaultModelId, defaultVoice));
  const [voiceId, setVoiceId] = useState(defaultVoice);
  const [lang, setLang] = useState('en');
  const [speed, setSpeed] = useState(defaultSpeed);
  const [voiceSheet, setVoiceSheet] = useState(false);
  const [langSheet, setLangSheet] = useState(false);
  const [confirmReprofile, setConfirmReprofile] = useState(false);

  const prerender = usePrerender(docId, chunks);
  const running = prerender.status === 'running';

  // Used to pad the scroll content so the start button clears the floating pill.
  const { playback } = usePlaybackContext();

  const settings: NarrationSettings = { modelId: model.id, voiceId, speed, steps, lang };
  const downloaded = areModelsDownloaded(model.id, voiceId);

  const totalChars = chunks.length ? chunks[chunks.length - 1].charEnd : 0;
  const estSeconds = totalChars / (CHARS_PER_SEC * speed);
  const estMinutes = Math.max(1, Math.round(estSeconds / 60));
  const estMb = Math.max(1, Math.round((estSeconds * AAC_BYTES_PER_SEC) / 1e6));

  const chooseModel = (m: ModelInfo) => {
    setModel(m);
    if (!m.langCodes.includes(lang as never)) setLang(m.langCodes[0]);
  };

  // A finished audiobook is pinned to its render profile; changing voice/model/
  // language (speed is live, so it's excluded) invalidates the cache — warn first.
  const cacheInvalidated = audiobook?.status === 'done' && audiobook.profileHash !== settingsHash(settings);

  const doStart = () => {
    setRenderProfile(docId, settings);
    prerender.start(settings);
  };

  const startRender = () => {
    if (cacheInvalidated) setConfirmReprofile(true);
    else doStart();
  };

  return (
    <View style={styles.screen}>
      <AppBar onBack={() => navigation.goBack()} title="Full audiobook" subtitle={doc?.title} />

      {chunks.length === 0 ? (
        <View style={styles.notReady}>
          {pdfText.status === 'loading' || pdfText.status === 'streaming' || pdfText.status === 'idle' ? (
            <>
              <Spinner size={32} color={p.primary} />
              <Text style={[ty(TYPE.body, p.textMuted), styles.notReadyText]}>
                Preparing pages…{pdfText.pageCount > 0 ? ` ${pdfText.loadedPages} / ${pdfText.pageCount}` : ''}
              </Text>
            </>
          ) : (
            // Error, or ready but no chunks — never leave an endless spinner.
            <>
              <Icon name="book" size={40} color={p.textDim} />
              <Text style={[ty(TYPE.body, p.textMuted), styles.notReadyText]}>
                Couldn’t prepare this book’s text{pdfText.error ? ` — ${pdfText.error}` : ''}.
              </Text>
              <Button label="Open book" variant="tonal" onPress={() => navigation.navigate('Reader', { docId })} />
            </>
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, playback.started && { paddingBottom: 112 }]}>
          <Text style={[ty(TYPE.body, p.textMuted), styles.intro]}>
            Generate the whole book ahead of time so playback never pauses to synthesize. Pick the voice and language, then start — you can keep using the app while it renders.
          </Text>

          <Text style={[ty(TYPE.label, p.textMuted), styles.sectionLabel]}>Quality</Text>
          <View style={styles.card}>
            {MODELS.map((m, i) => {
              const selected = m.id === model.id;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => chooseModel(m)}
                  disabled={running}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[
                    styles.optionRow,
                    {
                      backgroundColor: selected ? p.primarySoft : 'transparent',
                      borderBottomWidth: i === MODELS.length - 1 ? 0 : 1,
                    },
                  ]}
                >
                  <View style={styles.optionBody}>
                    <Text style={ty(TYPE.bodyMedium, p.text)}>{m.label}</Text>
                    <Text style={ty(TYPE.bodySmall, p.textMuted)}>{m.tagline} · ~{m.approxMb} MB</Text>
                  </View>
                  {selected ? <Icon name="check" size={20} color={p.primary} /> : null}
                </Pressable>
              );
            })}
          </View>

          <Text style={[ty(TYPE.label, p.textMuted), styles.sectionLabel]}>Voice & language</Text>
          <View style={styles.card}>
            <Pressable onPress={() => setVoiceSheet(true)} disabled={running} style={[styles.optionRow, styles.rowDivider]}>
              <Text style={ty(TYPE.body, p.text)}>Voice</Text>
              <View style={styles.rowValue}>
                <Text style={ty(TYPE.body, p.textMuted)}>{voiceLabel(voiceId)}</Text>
                <Icon name="chevR" size={18} color={p.textDim} />
              </View>
            </Pressable>
            <Pressable onPress={() => setLangSheet(true)} disabled={running} style={styles.optionRow}>
              <Text style={ty(TYPE.body, p.text)}>Language</Text>
              <View style={styles.rowValue}>
                <Text style={ty(TYPE.body, p.textMuted)}>{languageLabel(lang)}</Text>
                <Icon name="chevR" size={18} color={p.textDim} />
              </View>
            </Pressable>
          </View>

          <Text style={[ty(TYPE.label, p.textMuted), styles.sectionLabel]}>Speed</Text>
          <View style={styles.speedRow}>
            {SPEED_PRESETS.map((v) => (
              <Chip key={v} label={`×${v.toFixed(2)}`} selected={Math.abs(speed - v) < 0.01} onPress={running ? undefined : () => setSpeed(v)} />
            ))}
          </View>

          <View style={[styles.estimate, { borderColor: p.border }]}>
            <Text style={ty(TYPE.bodyMedium, p.text)}>≈ {chunks.length} clips · ≈ {estMinutes} min · ≈ {estMb} MB</Text>
            <Text style={[ty(TYPE.caption, p.textDim), styles.estimateNote]}>
              Audio is compressed (AAC), so it stays small. Already-rendered clips are reused.
            </Text>
          </View>

          {!downloaded ? (
            <View style={[styles.notice, { backgroundColor: p.surfaceAlt }]}>
              <Text style={[ty(TYPE.bodySmall, p.textMuted), styles.noticeText]}>
                {voiceLabel(voiceId)} on {model.label} isn’t downloaded yet.
              </Text>
              <Button label="Get this voice" size="sm" variant="tonal" onPress={() => navigation.navigate('VoiceModel')} />
            </View>
          ) : null}

          <View style={styles.footer}>
            {running ? (
              <>
                <ProgressBar value={prerender.progress} height={8} />
                <Text style={[ty(TYPE.body, p.text), styles.progressText]}>
                  {prerender.done} / {prerender.total} · {Math.round(prerender.progress * 100)}%
                </Text>
                <Button label="Cancel" variant="ghost" full onPress={prerender.cancel} />
              </>
            ) : prerender.status === 'done' ? (
              <>
                <Text style={[ty(TYPE.body, p.success), styles.progressText]}>Audiobook ready — every clip is cached.</Text>
                <Button label="Open & play" icon="play" variant="filled" full onPress={() => navigation.navigate('Reader', { docId })} />
              </>
            ) : prerender.status === 'cancelled' ? (
              <>
                <Text style={[ty(TYPE.body, p.textMuted), styles.progressText]}>
                  Stopped at {prerender.done} / {prerender.total}. Resume anytime.
                </Text>
                <Button label="Resume" icon="download" variant="filled" full disabled={!downloaded} onPress={startRender} />
              </>
            ) : (
              <>
                {prerender.status === 'error' && prerender.error ? (
                  <Text style={[ty(TYPE.bodySmall, p.danger), styles.progressText]}>{prerender.error}</Text>
                ) : null}
                <Button
                  label="Make full audiobook"
                  icon="download"
                  variant="filled"
                  full
                  disabled={!downloaded || chunks.length === 0}
                  onPress={startRender}
                />
              </>
            )}
          </View>
        </ScrollView>
      )}

      <Sheet open={voiceSheet} onClose={() => setVoiceSheet(false)} title="Voice" heightRatio={0.7}>
        <VoicePicker value={voiceId} onChange={(id) => { setVoiceId(id); setVoiceSheet(false); }} modelId={model.id} lang={lang} />
      </Sheet>

      <Sheet open={langSheet} onClose={() => setLangSheet(false)} title="Language" heightRatio={0.6}>
        <ScrollView>
          {model.langCodes.map((code, i) => (
            <Pressable
              key={code}
              onPress={() => { setLang(code); setLangSheet(false); }}
              style={[
                styles.langRow,
                {
                  backgroundColor: code === lang ? p.primarySoft : 'transparent',
                  borderBottomWidth: i === model.langCodes.length - 1 ? 0 : 1,
                  borderBottomColor: p.border,
                },
              ]}
            >
              <Text style={ty(TYPE.body, p.text)}>{languageLabel(code)}</Text>
              {code === lang ? <Icon name="check" size={20} color={p.primary} /> : null}
            </Pressable>
          ))}
        </ScrollView>
      </Sheet>

      <ActionDialog
        open={confirmReprofile}
        onClose={() => setConfirmReprofile(false)}
        title="Re-render this audiobook?"
        message="You’ve changed the voice, model or language. The audio already cached for this book can’t be reused, so it will be rendered again from scratch."
        actions={[
          { label: 'Re-render', variant: 'filled', onPress: doStart },
          { label: 'Cancel', variant: 'ghost' },
        ]}
      />

      {/* Hidden — drives headless text extraction when the manifest isn't ready. */}
      {pdfText.extractor}
    </View>
  );
}

import * as Clipboard from 'expo-clipboard';
import { File } from 'expo-file-system';
import { useEffect, useMemo, useState } from 'react';
import { Button, ScrollView, Text, View } from 'react-native';
import { DeveloperAction } from '../../components';
import {
  buildChunks,
  chunkAudioUri,
  DEFAULT_VOICE,
  ensureChunkAudio,
  loadChunks,
  planProsody,
  qualityProfile,
  withEngine,
  type NarrationSettings,
  type NarrationSynthesisMetrics,
  type SynthesisStage,
} from '../../supertonic';
import { loadExtractedText } from '../../pdf';
import { usePlaybackContext } from '../../playback';
import {
  VoiceBenchmarkService,
  VOICE_PLAYBACK_TIMEOUT_MS,
  analyzeDocumentForBenchmark,
  benchmarkRow as row,
  benchmarkStageRow as stageRow,
  describeBenchmarkError as describe,
  firstAudioMilliseconds as firstAudioMsFor,
  formatBenchmarkTrace as formatTrace,
  formatProductionMetrics,
  maximum as max,
  milliseconds as ms,
  minimum as min,
  percentile,
  reportPlaybackBenchmark,
  requireBenchmarkValue as requireValue,
  resetPlaybackBenchmark,
  sleep,
  standardRtf,
  synthesisThroughput as throughput,
  type VoiceBenchmarkConfig,
  type VoiceChunkBenchmark,
} from '../../services';
import { useDocumentsStore, useSettingsStore } from '../../stores';
import { useTheme } from '../../theme';
import type { ImportedDocument } from '../../types';
import { SAMPLE_TEXT, traceStart, traceStop } from '../../utils';
import { makeStyles } from './TextToSpeechDemoScreen.styles';


// Multi-paragraph passage that chunks into 5+ ~300-char chunks, mirroring a real
// document so the benchmark can measure time-to-first-audio and throughput.
const SAMPLE_DOC = `Reading aloud has accompanied the written word for almost as long as writing itself. In the libraries of the ancient world, texts were rarely read in silence; a reader would murmur the words, letting the sound shape the meaning. The practice persisted through the monasteries of the early medieval period, where copying and reciting were inseparable acts of devotion and study.

When silent reading finally became common, something was quietly lost. The voice gives a sentence its rhythm, its hesitations, and its emphasis, and a page of prose can feel very different when it is spoken than when it is merely scanned. Modern speech synthesis tries to recover a little of that lost music, turning flat characters back into something a listener can follow without ever looking down.

A good reading voice has to do more than pronounce words correctly. It must decide where to pause, which syllables to stress, and how to carry the shape of a long sentence across its many clauses. Tiny errors in timing are far more noticeable than small errors in tone, because the ear is exquisitely sensitive to rhythm and expects a steady, natural cadence.

Doing all of this on a phone, with no network connection and no remote server to lean on, is a genuine engineering challenge. The model has to be small enough to fit in memory, fast enough to keep ahead of the listener, and steady enough that the seams between one passage and the next never intrude on the experience of simply being read to.`;

const SUSTAINED_CHUNKS = 5; // chunks (incl. the first) timed for the throughput pass
const REPEAT_RUNS = 5;

const STAGE_LABELS: Record<SynthesisStage, string> = {
  tokenize: 'tokenize',
  duration: 'duration predictor',
  textEncoder: 'text encoder',
  initLatent: 'init latent',
  denoise: 'denoise loop',
  vocoder: 'vocoder',
};

const TEST_ITINERARY = [
  ['Smoke test', 'Confirm that the selected model can synthesize and play audio.'],
  ['Analyze a document', 'Check extraction, headings, chunk sizes, and the hard chunk cap.'],
  ['Trace real synthesis', 'Measure the production Float32 → native AAC path on the selected document.'],
  ['Run clean benchmark', 'Measure time-to-first-audio and sustained throughput before deliberately heating the device.'],
  ['Trace reader playback', 'Reset the trace, play in the reader, stop, start from the next sentence, cross several boundaries, then report it here.'],
  ['Warm repeat ×5', 'Stress the warm engine last to expose variance and thermal drift.'],
  ['Cold load', 'Measure model loading last; it deliberately releases the warm engine.'],
  ['Copy results', 'Export the complete log for comparison with the previous build.'],
] as const;

// Voice engine performance lab (Developer tool): "Run benchmark" reports the
// cold-start latency breakdown + time-to-first-audio + a throughput pass;
// "Smoke test" is a quick single-sentence synth+play liveness check.
export default function TextToSpeechDemoScreen() {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const modelId = useSettingsStore((s) => s.modelId);
  const voiceId = useSettingsStore((s) => s.voiceId);
  const lang = useSettingsStore((s) => s.lang);
  const settingsSteps = useSettingsStore((s) => s.steps);
  const quality = useSettingsStore((s) => s.quality);
  const tone = useSettingsStore((s) => s.tone);
  const documents = useDocumentsStore((s) => s.documents);
  const { clearActiveDoc } = usePlaybackContext();

  const [log, setLog] = useState('Voice engine performance lab.\n');
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState(Math.max(5, settingsSteps));
  const [analyzedDoc, setAnalyzedDoc] = useState<ImportedDocument | null>(null);
  const benchmark = useMemo(() => new VoiceBenchmarkService(), []);
  const benchmarkConfig = useMemo<VoiceBenchmarkConfig>(() => ({
    modelId,
    voiceId: voiceId || DEFAULT_VOICE,
    language: lang,
    steps,
  }), [modelId, voiceId, lang, steps]);

  useEffect(() => () => benchmark.dispose(), [benchmark]);

  const append = (line: string) => {
    console.log('[tts-perf]', line);
    setLog((prev) => prev + line + '\n');
  };

  const ensureLoaded = () => benchmark.ensureLoaded(benchmarkConfig, append);
  const benchChunk = (text: string): Promise<VoiceChunkBenchmark> => benchmark.benchmarkChunk(text, benchmarkConfig);
  const play = (uri: string) => benchmark.play(uri);

  const runBenchmark = async () => {
    setBusy(true);
    try {
      await ensureLoaded();

      // Build-chunks: on a large PDF this happens before any audio can play.
      const bcStart = Date.now();
      const chunks = buildChunks(SAMPLE_DOC, 300);
      append(`Built ${chunks.length} chunks from ${SAMPLE_DOC.length} chars in ${Date.now() - bcStart} ms.`);
      const firstChunk = requireValue(chunks[0], 'Sample produced no chunks.');
      append(row('configuration', `${modelId} · voice ${voiceId || DEFAULT_VOICE} · lang ${lang} · steps ${steps} · ${quality}`));

      // First chunk = time-to-first-audio. The headline number.
      append(`\n── First chunk (time-to-first-audio) · ${firstChunk.text.length} chars · steps=${steps} ──`);
      const r = await benchChunk(firstChunk.text);
      const stageMs = (s: SynthesisStage) => r.stages[s] ?? 0;
      const denoise = stageMs('denoise');
      const perStep = steps > 0 ? denoise / steps : 0;
      const firstStep =
        r.stepStarts.length >= 2 ? r.stepStarts[1] - r.stepStarts[0] : denoise;

      append(stageRow(STAGE_LABELS.tokenize, stageMs('tokenize'), r.synthMs));
      append(stageRow(STAGE_LABELS.duration, stageMs('duration'), r.synthMs));
      append(stageRow(STAGE_LABELS.textEncoder, stageMs('textEncoder'), r.synthMs));
      append(stageRow(STAGE_LABELS.initLatent, stageMs('initLatent'), r.synthMs));
      append(stageRow(`${STAGE_LABELS.denoise} (×${steps})`, denoise, r.synthMs, `${ms(perStep)}/step, 1st ${ms(firstStep)}`));
      append(stageRow(STAGE_LABELS.vocoder, stageMs('vocoder'), r.synthMs));
      append(stageRow('encode WAV', r.encodeMs, firstAudioMsFor(r)));
      append(stageRow('write file', r.writeMs, firstAudioMsFor(r)));
      append('  ' + '─'.repeat(28));
      append(row('synth total', ms(r.synthMs)));
      const firstAudioMs = r.synthMs + r.encodeMs + r.writeMs;
      append(row('≈ first audio', ms(firstAudioMs)));
      append(row('audio length', `${r.audioSec.toFixed(2)} s  (predicted ${r.predictedSec.toFixed(2)} s)`));
      append(row('tokens / samples', `${r.diagnostics.tokenCount} / ${r.diagnostics.waveformSamples.toLocaleString()}`));
      append(row('latent dim × len', `${r.diagnostics.latentDim} × ${r.diagnostics.latentLen}`));
      append(row('synth RTF', standardRtf(r.synthMs, r.audioSec).toFixed(3)));
      append(row('synth throughput', `${throughput(r.synthMs, r.audioSec).toFixed(2)}× realtime`));

      const playback = await play(r.uri);
      append(row('audio session', ms(playback.audioSessionMs)));
      append(row('player create', ms(playback.createMs)));
      append(row('player loaded', playback.loadedMs == null ? 'not observed' : ms(playback.loadedMs)));
      append(row('player playing', playback.playingMs == null ? (playback.timedOut ? `>${VOICE_PLAYBACK_TIMEOUT_MS} ms` : 'error') : ms(playback.playingMs)));
      if (playback.playingMs != null) {
        const tapToPlaying = firstAudioMs + playback.playingMs;
        append(row('synth → playing', `${ms(tapToPlaying)} · RTF ${standardRtf(tapToPlaying, r.audioSec).toFixed(3)}`));
      }

      // Sustained throughput: do the next few chunks back-to-back. RTF < 1 means
      // synthesis beats realtime, so generate-ahead prefetch can keep up.
      const n = Math.min(SUSTAINED_CHUNKS, chunks.length);
      if (n > 1) {
        append(`\n── Sustained throughput · chunks 2–${n} ──`);
        let totalSynth = r.synthMs;
        let totalAudio = r.audioSec;
        for (let i = 1; i < n; i++) {
          const c = await benchChunk(chunks[i].text);
          totalSynth += c.synthMs;
          totalAudio += c.audioSec;
          append(row(`chunk ${i + 1} (${chunks[i].text.length}c)`, `${ms(c.synthMs)} → ${c.audioSec.toFixed(2)} s  RTF ${(c.synthMs / 1000 / Math.max(0.001, c.audioSec)).toFixed(2)}`));
        }
        const aggRtf = totalSynth / 1000 / Math.max(0.001, totalAudio);
        append('  ' + '─'.repeat(28));
        append(row('aggregate RTF', `${aggRtf.toFixed(3)}  ${aggRtf < 1 ? '(beats realtime ✓)' : '(slower than realtime ✗)'}`));
      }
      append('');
    } catch (error) {
      append('BENCHMARK ERROR: ' + describe(error));
    } finally {
      setBusy(false);
    }
  };

  // Repeat one identical warm synthesis so scheduler noise and thermal drift are
  // visible. Uses the analyzed document's first chunk when available.
  const repeatBenchmark = async () => {
    setBusy(true);
    try {
      clearActiveDoc();
      await sleep(700);
      await ensureLoaded();
      let label = 'sample document';
      let text = buildChunks(SAMPLE_DOC, qualityProfile(quality).unitLen)[0]?.text;
      if (analyzedDoc) {
        const extracted = loadExtractedText(analyzedDoc.docHash);
        const chunk = extracted
          ? loadChunks(analyzedDoc.docHash, extracted.text, qualityProfile(quality).unitLen)[0]
          : undefined;
        if (chunk) {
          label = analyzedDoc.title;
          text = chunk.text;
        }
      }
      const benchmarkText = requireValue(text, 'No benchmark chunk available.');

      append(`\n── Warm repeat ×${REPEAT_RUNS} · ${label} · ${benchmarkText.length} chars ──`);
      append(row('configuration', `${modelId} · voice ${voiceId || DEFAULT_VOICE} · lang ${lang} · steps ${steps} · ${quality}`));
      const synthTimes: number[] = [];
      const denoiseTimes: number[] = [];
      const rtfs: number[] = [];
      let audioSec = 0;
      for (let i = 0; i < REPEAT_RUNS; i++) {
        const result = await benchChunk(benchmarkText);
        const denoiseMs = result.stages.denoise ?? 0;
        const rtf = standardRtf(result.synthMs, result.audioSec);
        synthTimes.push(result.synthMs);
        denoiseTimes.push(denoiseMs);
        rtfs.push(rtf);
        audioSec = result.audioSec;
        append(row(`run ${i + 1}`, `${ms(result.synthMs)} · denoise ${ms(denoiseMs)} · ${result.audioSec.toFixed(2)} s · RTF ${rtf.toFixed(3)}`));
      }
      append('  ' + '─'.repeat(28));
      append(row('synth min / median / max', `${ms(min(synthTimes))} / ${ms(percentile(synthTimes, 0.5))} / ${ms(max(synthTimes))}`));
      append(row('synth p90', ms(percentile(synthTimes, 0.9))));
      append(row('denoise median', ms(percentile(denoiseTimes, 0.5))));
      append(row('RTF median / p90', `${percentile(rtfs, 0.5).toFixed(3)} / ${percentile(rtfs, 0.9).toFixed(3)}`));
      append(row('audio length', `${audioSec.toFixed(2)} s`));
    } catch (error) {
      append('REPEAT BENCHMARK ERROR: ' + describe(error));
    } finally {
      setBusy(false);
    }
  };

  const smokeTest = async () => {
    setBusy(true);
    try {
      await ensureLoaded();
      append(`Smoke test: synthesizing the sample (steps=${steps})...`);
      traceStart();
      const r = await benchChunk(SAMPLE_TEXT);
      append(formatTrace(traceStop()));
      append(`  synth ${ms(r.synthMs)}, audio ${r.audioSec.toFixed(2)} s, RTF ${standardRtf(r.synthMs, r.audioSec).toFixed(3)}, throughput ${throughput(r.synthMs, r.audioSec).toFixed(2)}×.`);
      append(row('latent dim × len', `${r.diagnostics.latentDim} × ${r.diagnostics.latentLen}`));
      const playback = await play(r.uri);
      append(row('file → playing', playback.playingMs == null ? 'not observed' : ms(playback.playingMs)));
    } catch (error) {
      append('SMOKE TEST ERROR: ' + describe(error));
    } finally {
      setBusy(false);
    }
  };

  // Release the resident sessions and reload them, tracing each session's load
  // time — the genuine cold-start cost broken down per ONNX model.
  const coldLoad = async () => {
    setBusy(true);
    try {
      append('\n── Cold load (release + reload) ──');
      const result = await benchmark.coldLoad(benchmarkConfig);
      append(formatTrace(result.spans));
      append('  ' + '─'.repeat(28));
      append(row('total cold load', ms(result.totalMs)));
    } catch (error) {
      append('COLD LOAD ERROR: ' + describe(error));
    } finally {
      setBusy(false);
    }
  };

  const copyResults = async () => {
    try {
      await Clipboard.setStringAsync(log);
      append('\n(results copied to clipboard)');
    } catch {
      append('\n(copy failed)');
    }
  };

  const analyzeDoc = (doc: ImportedDocument) => {
    setAnalyzedDoc(doc);
    analyzeDocumentForBenchmark(doc, quality).forEach(append);
  };

  // Synthesize chunk 0 of the analyzed doc through the real production path
  // (ensureChunkAudio → AAC), traced end to end. Only traces a fresh synth.
  const traceRealSynth = async () => {
    if (!analyzedDoc) {
      append('\nAnalyze a document first.');
      return;
    }
    setBusy(true);
    try {
      // Quiesce the app's background warmer (the reader's active doc persists into
      // dev mode) so its synthesis doesn't pollute the trace, then let it drain.
      clearActiveDoc();
      await sleep(700);
      await ensureLoaded();
      const extracted = requireValue(loadExtractedText(analyzedDoc.docHash), 'not extracted');
      const chunks = loadChunks(analyzedDoc.docHash, extracted.text, qualityProfile(quality).unitLen);
      const firstChunk = requireValue(chunks[0], 'no chunks');
      const selectedModelId = requireValue(modelId, 'No voice model selected.');
      const settings: NarrationSettings = { modelId: selectedModelId, voiceId: voiceId || DEFAULT_VOICE, speed: 1, steps, lang, quality, tone };
      // Force a fresh synth so there's something to trace (not a cache hit).
      try {
        const f = new File(chunkAudioUri(analyzedDoc.docHash, firstChunk.charStart, settings));
        if (f.exists) f.delete();
      } catch {}
      append(`\n── Real synth path · chunk 0 (${firstChunk.text.length}c) ──`);
      append(row('configuration', `${modelId} · voice ${voiceId || DEFAULT_VOICE} · lang ${lang} · steps ${steps} · ${quality} · ${tone} tone · unit ${qualityProfile(quality).unitLen}`));
      const prosody = planProsody(extracted.text, firstChunk.charStart, firstChunk.charEnd);
      append(row('prosody', `${prosody.boundary} · ${prosody.trailingPauseMs} ms trailing pause`));
      traceStart();
      const t0 = Date.now();
      let metrics: NarrationSynthesisMetrics | null = null;
      await withEngine(selectedModelId, (tts) =>
        ensureChunkAudio(
          tts,
          benchmark.getLoadedVoice(),
          analyzedDoc.docHash,
          extracted.text,
          firstChunk,
          settings,
          (reported) => { metrics = reported; },
        ),
      );
      const spans = traceStop();
      append(formatTrace(spans));
      append('  ' + '─'.repeat(28));
      append(row('total', ms(Date.now() - t0)));
      if (metrics) append(formatProductionMetrics(metrics));
      if (spans.length === 0) append('  (no synth captured)');
    } catch (error) {
      append('SYNTH TRACE ERROR: ' + describe(error));
    } finally {
      setBusy(false);
    }
  };

  const resetPlaybackTrace = () => {
    resetPlaybackBenchmark();
    append('\nProduction playback trace reset. Open the reader and run Test 5 now.');
  };

  const reportPlaybackTrace = () => {
    reportPlaybackBenchmark(modelId).forEach(append);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.eyebrow}>Developer tools</Text>
      <Text style={styles.title}>Voice engine performance lab</Text>
      <Text style={styles.hint}>
        Install a voice model first. Tests use {voiceId || DEFAULT_VOICE}, language {lang}, and the selected quality profile. Five steps is the fast-profile minimum; keep the selected profile's configured value unless deliberately comparing steps.
      </Text>
      <Text style={styles.status}>{busy ? 'Test running — controls locked' : 'Ready to test'}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Test itinerary</Text>
        <Text style={styles.sectionHint}>Run these in order so warm-engine and cold-load results remain comparable.</Text>
        <View style={styles.itinerary}>
          {TEST_ITINERARY.map(([title, description], index) => (
            <View key={title} style={styles.itineraryItem}>
              <Text style={styles.itineraryNumber}>{index + 1}</Text>
              <View style={styles.itineraryBody}>
                <Text style={styles.itineraryTitle}>{title}</Text>
                <Text style={styles.itineraryDescription}>{description}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Synthesis steps</Text>
        <Text style={styles.sectionHint}>Fast minimum: five steps. The {quality} profile defaults to {qualityProfile(quality).steps}; change it only for a deliberate quality comparison.</Text>
        <View style={styles.actionCard}>
          <Text style={styles.stepValue}>Current value: {steps}</Text>
          <View style={styles.stepButtons}>
            <View style={styles.stepButton}>
              <Button
                title="Decrease"
                color={palette.primary}
                onPress={() => setSteps((current) => Math.max(5, current - 1))}
                disabled={busy || steps <= 5}
              />
              <Text style={styles.actionDescription}>Lowers inference work. The lab will not run fewer than five denoising steps.</Text>
            </View>
            <View style={styles.stepButton}>
              <Button
                title="Increase"
                color={palette.primary}
                onPress={() => setSteps((current) => current + 1)}
                disabled={busy}
              />
              <Text style={styles.actionDescription}>Adds denoising passes to compare slower, higher-step synthesis.</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Run tests</Text>
        <Text style={styles.sectionHint}>Each action writes its measurements to the results console at the bottom.</Text>
        <DeveloperAction
          order="Test 1"
          title="Smoke test"
          description="Synthesizes and plays one short sample. Start here to verify that the engine, voice, file output, and player all work."
          onPress={() => void smokeTest()}
          disabled={busy}
        />

        <Text style={styles.sectionTitle}>Choose a document</Text>
        <Text style={styles.sectionHint}>Test 2 analyzes text only. Select the large PDF and the small document separately.</Text>
        {documents.length > 0 ? (
          documents.slice(0, 12).map((document) => (
            <DeveloperAction
              key={document.docHash}
              order="Test 2"
              title={`Analyze · ${document.title.slice(0, 28)}`}
              description={`Reports extraction, headings, chunk distribution, P95 size, and over-cap count for “${document.title}”.`}
              onPress={() => analyzeDoc(document)}
              disabled={busy}
            />
          ))
        ) : (
          <Text style={styles.emptyDocuments}>Import a PDF, Markdown, or DOCX document before running document-specific tests.</Text>
        )}
        {analyzedDoc ? <Text style={styles.selectedDocument}>Selected: {analyzedDoc.title}</Text> : null}

        <DeveloperAction
          order="Test 3"
          title="Trace real synthesis"
          description={
            analyzedDoc
              ? `Deletes chunk 0 for “${analyzedDoc.title}”, then measures the complete production synthesis and native AAC path.`
              : 'Analyze a document first. This test then measures its first chunk through the production AAC path.'
          }
          onPress={() => void traceRealSynth()}
          disabled={busy || !analyzedDoc}
        />
        <DeveloperAction
          order="Test 4"
          title="Run clean benchmark"
          description="Measures first-audio latency and sustained throughput before the warm-repeat stress pass heats or throttles the device."
          onPress={() => void runBenchmark()}
          disabled={busy}
        />
        <DeveloperAction
          order="Test 5 · setup"
          title="Reset playback trace"
          description="Clears production playback timings. Then open the reader, play a paragraph, stop, start from its next sentence, and let playback cross at least five boundaries."
          onPress={resetPlaybackTrace}
          disabled={busy}
        />
        <DeveloperAction
          order="Test 5 · report"
          title="Report playback trace"
          description="After the reader scenario, reports real cache decisions, synthesis and queue time, player startup, boundary gaps, prefetch depth, redundant work, and device state."
          onPress={reportPlaybackTrace}
          disabled={busy}
        />
        <DeveloperAction
          order="Test 6"
          title={`Warm repeat ×${REPEAT_RUNS}`}
          description="Runs the repeated warm synthesis stress pass after clean measurements to expose median, P90, scheduler noise, and thermal drift."
          onPress={() => void repeatBenchmark()}
          disabled={busy}
        />
        <DeveloperAction
          order="Test 7 · run last"
          title="Cold load"
          description="Releases the resident ONNX sessions and times a complete reload. Run last because it intentionally destroys the warm baseline."
          onPress={() => void coldLoad()}
          disabled={busy}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Results</Text>
        <Text style={styles.sectionHint}>Copy the log before clearing it. The console itself scrolls independently.</Text>
        <DeveloperAction
          order="Test 8 · export"
          title="Copy results"
          description="Copies the entire measurement log to the clipboard so it can be saved or compared with another build."
          onPress={() => void copyResults()}
        />
        <DeveloperAction
          order="Utility"
          title="Clear results"
          description="Clears only the visible developer log. It does not remove model files or the narration cache."
          tone="danger"
          onPress={() => setLog('')}
          disabled={busy}
        />
        <ScrollView style={styles.logBox} nestedScrollEnabled>
          <Text selectable style={styles.logText}>{log}</Text>
        </ScrollView>
      </View>
    </ScrollView>
  );
}

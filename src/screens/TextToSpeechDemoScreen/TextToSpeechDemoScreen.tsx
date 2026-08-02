import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import { useMemo, useRef, useState } from 'react';
import { Button, ScrollView, Text, View } from 'react-native';
import {
  buildChunks,
  chunkAudioUri,
  DEFAULT_VOICE,
  encodeWav,
  ensureChunkAudio,
  getEngine,
  getNarrationPerfCounters,
  getSynthRtf,
  getVoice,
  isEngineResident,
  loadChunks,
  maxChunkLen,
  planProsody,
  qualityProfile,
  releaseCurrentEngine,
  clearNarrationPerfCounters,
  TextToSpeech,
  VoiceStyle,
  withEngine,
  type NarrationSettings,
  type NarrationSynthesisMetrics,
  type SynthesisDiagnostics,
  type SynthesisStage,
} from '../../supertonic';
import { getDevicePerformanceSnapshot } from '../../../modules/device-performance';
import { loadExtractedText } from '../../pdf';
import { classifyDevicePressure, clearPlaybackDiagnostics, getPlaybackDiagnostics, prefetchDepth, usePlaybackContext } from '../../playback';
import { useDocumentsStore, useSettingsStore } from '../../stores';
import { useTheme } from '../../theme';
import type { ImportedDocument } from '../../types';
import { SAMPLE_TEXT, traceMark, traceStart, traceStop, type Span } from '../../utils';
import { makeStyles } from './TextToSpeechDemoScreen.styles';


// Multi-paragraph passage that chunks into 5+ ~300-char chunks, mirroring a real
// document so the benchmark can measure time-to-first-audio and throughput.
const SAMPLE_DOC = `Reading aloud has accompanied the written word for almost as long as writing itself. In the libraries of the ancient world, texts were rarely read in silence; a reader would murmur the words, letting the sound shape the meaning. The practice persisted through the monasteries of the early medieval period, where copying and reciting were inseparable acts of devotion and study.

When silent reading finally became common, something was quietly lost. The voice gives a sentence its rhythm, its hesitations, and its emphasis, and a page of prose can feel very different when it is spoken than when it is merely scanned. Modern speech synthesis tries to recover a little of that lost music, turning flat characters back into something a listener can follow without ever looking down.

A good reading voice has to do more than pronounce words correctly. It must decide where to pause, which syllables to stress, and how to carry the shape of a long sentence across its many clauses. Tiny errors in timing are far more noticeable than small errors in tone, because the ear is exquisitely sensitive to rhythm and expects a steady, natural cadence.

Doing all of this on a phone, with no network connection and no remote server to lean on, is a genuine engineering challenge. The model has to be small enough to fit in memory, fast enough to keep ahead of the listener, and steady enough that the seams between one passage and the next never intrude on the experience of simply being read to.`;

const OUTPUT_FILE = 'tts_perf_output.wav';
const SUSTAINED_CHUNKS = 5; // chunks (incl. the first) timed for the throughput pass
const REPEAT_RUNS = 5;
const PLAYBACK_TIMEOUT_MS = 5000;

const STAGE_LABELS: Record<SynthesisStage, string> = {
  tokenize: 'tokenize',
  duration: 'duration predictor',
  textEncoder: 'text encoder',
  initLatent: 'init latent',
  denoise: 'denoise loop',
  vocoder: 'vocoder',
};

type ChunkBench = {
  stages: Record<string, number>;
  stepStarts: number[];
  synthMs: number;
  encodeMs: number;
  writeMs: number;
  audioSec: number;
  predictedSec: number;
  diagnostics: SynthesisDiagnostics;
  uri: string;
};

type PlaybackBench = {
  audioSessionMs: number;
  createMs: number;
  loadedMs: number | null;
  playingMs: number | null;
  timedOut: boolean;
};

type ScreenStyles = ReturnType<typeof makeStyles>;

type DevActionProps = {
  styles: ScreenStyles;
  order: string;
  title: string;
  description: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
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

function DevAction({ styles, order, title, description, color, onPress, disabled }: DevActionProps) {
  return (
    <View style={styles.actionCard}>
      <Text style={styles.actionOrder}>{order}</Text>
      <Button title={title} color={color} onPress={onPress} disabled={disabled} />
      <Text style={styles.actionDescription}>{description}</Text>
    </View>
  );
}

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
  const ttsRef = useRef<TextToSpeech | null>(null);
  const voiceRef = useRef<VoiceStyle | null>(null);
  const engineProfileRef = useRef<string | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);

  const append = (line: string) => {
    console.log('[tts-perf]', line);
    setLog((prev) => prev + line + '\n');
  };

  // First use pays the genuine cold-load cost; later runs either reuse local
  // references or attach to the shared resident engine without claiming a cold load.
  const ensureLoaded = async () => {
    if (!modelId) throw new Error('No voice model selected — pick one in Settings → Voice model.');
    const v = voiceId || DEFAULT_VOICE;
    const profile = `${modelId}:${v}`;
    if (isEngineResident(modelId) && engineProfileRef.current === profile && ttsRef.current && voiceRef.current) {
      append('Sessions already loaded (warm) — skipping cold load.');
      return;
    }
    const resident = isEngineResident(modelId);
    append(resident
      ? `Attaching to resident ONNX sessions (${modelId}, voice ${v})...`
      : `Cold-loading ONNX sessions (${modelId}, voice ${v})...`);
    const start = Date.now();
    // Shared engine — reuses playback's resident sessions, no second copy.
    ttsRef.current = await getEngine(modelId);
    voiceRef.current = await getVoice(modelId, v);
    engineProfileRef.current = profile;
    append(`  ${resident ? 'attached' : 'sessions loaded'} in ${seconds(Date.now() - start)} s  (sampleRate=${ttsRef.current.sampleRate}).`);
  };

  // Synthesize one chunk, capturing per-stage + encode/write timings and writing
  // the WAV so it can be played later. Does not play.
  const benchChunk = async (text: string): Promise<ChunkBench> => {
    const selectedModelId = requireValue(modelId, 'No voice model selected.');
    const voice = voiceRef.current!;
    const stages: Record<string, number> = {};
    const stepStarts: number[] = [];
    let last = Date.now();
    const synthStart = last;

    const { waveform, durationsSec, diagnostics, sampleRate } = await withEngine(selectedModelId, async (tts) => ({
      ...(await tts.synthesize(
        text,
        lang,
        voice,
        steps,
        1.0,
        () => stepStarts.push(Date.now()),
        (stage) => {
          const now = Date.now();
          stages[stage] = now - last;
          last = now;
          traceMark(stage);
        },
      )),
      sampleRate: tts.sampleRate,
    }));
    const synthMs = Date.now() - synthStart;

    const encStart = Date.now();
    const bytes = encodeWav(waveform, sampleRate);
    const encodeMs = Date.now() - encStart;

    const wrStart = Date.now();
    const output = new File(Paths.document, OUTPUT_FILE);
    if (output.exists) output.delete();
    output.create();
    output.write(bytes);
    const writeMs = Date.now() - wrStart;

    return {
      stages,
      stepStarts,
      synthMs,
      encodeMs,
      writeMs,
      audioSec: waveform.length / sampleRate,
      predictedSec: durationsSec[0] ?? 0,
      diagnostics,
      uri: output.uri,
    };
  };

  // Best observable proxy for file-to-sound latency: native player status
  // reports loaded and playing. It cannot measure speaker hardware latency.
  const play = async (uri: string): Promise<PlaybackBench> => {
    const t0 = Date.now();
    await setAudioModeAsync({ playsInSilentMode: true });
    const audioSessionMs = Date.now() - t0;
    const createStart = Date.now();
    playerRef.current?.remove?.();
    playerRef.current = createAudioPlayer(uri);
    const player = playerRef.current;
    const createMs = Date.now() - createStart;
    let loadedMs: number | null = player.isLoaded ? Date.now() - t0 : null;

    return new Promise((resolve) => {
      let settled = false;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      let subscription: { remove: () => void } | null = null;
      const finish = (playingMs: number | null, timedOut: boolean) => {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        subscription?.remove();
        resolve({ audioSessionMs, createMs, loadedMs, playingMs, timedOut });
      };
      subscription = player.addListener('playbackStatusUpdate', (status) => {
        const elapsed = Date.now() - t0;
        if (status.isLoaded && loadedMs == null) loadedMs = elapsed;
        if (status.error) finish(null, false);
        else if (status.playing) finish(elapsed, false);
      });
      timeout = setTimeout(() => finish(null, true), PLAYBACK_TIMEOUT_MS);
      player.play();
    });
  };

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
      append(row('player playing', playback.playingMs == null ? (playback.timedOut ? `>${PLAYBACK_TIMEOUT_MS} ms` : 'error') : ms(playback.playingMs)));
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
      const selectedModelId = requireValue(modelId, 'No voice model selected — pick one in Settings → Voice model.');
      append('\n── Cold load (release + reload) ──');
      await releaseCurrentEngine();
      ttsRef.current = null;
      voiceRef.current = null;
      engineProfileRef.current = null;
      traceStart();
      const start = Date.now();
      ttsRef.current = await getEngine(selectedModelId);
      voiceRef.current = await getVoice(selectedModelId, voiceId || DEFAULT_VOICE);
      engineProfileRef.current = `${selectedModelId}:${voiceId || DEFAULT_VOICE}`;
      const total = Date.now() - start;
      append(formatTrace(traceStop()));
      append('  ' + '─'.repeat(28));
      append(row('total cold load', ms(total)));
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

  // Extraction/reading diagnostics on an already-extracted document: block kinds,
  // chunk sizes, suspected-missed headings, and a spoken-text preview.
  const analyzeDoc = (doc: ImportedDocument) => {
    setAnalyzedDoc(doc);
    const extracted = loadExtractedText(doc.docHash);
    if (!extracted) {
      append(`\n"${doc.title}" — not extracted yet. Open it in the reader once, then retry.`);
      return;
    }
    const unitLen = qualityProfile(quality).unitLen;
    const chunks = loadChunks(doc.docHash, extracted.text, unitLen);
    append(`\n══ ${doc.title} (${doc.kind}) ══`);
    append(row('chars / pages', `${extracted.text.length} / ${extracted.pageCount}`));

    const kinds: Record<string, number> = {};
    for (const b of extracted.blocks) kinds[b.kind] = (kinds[b.kind] ?? 0) + 1;
    append(row('blocks', Object.entries(kinds).map(([k, n]) => `${k}:${n}`).join('  ') || '(none)'));

    const sizes = chunks.map((c) => c.text.length);
    const cap = maxChunkLen(extracted.text, unitLen);
    const maxSize = sizes.length ? Math.max(...sizes) : 0;
    const minSize = sizes.length ? Math.min(...sizes) : 0;
    const avg = sizes.length ? Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length) : 0;
    const p95 = percentile(sizes, 0.95);
    const overCap = sizes.filter((size) => size > cap).length;
    append(
      row(
        `chunks (cap ${cap})`,
        `${chunks.length}  · avg ${avg} · p95 ${p95} · min ${minSize} · max ${maxSize} · over-cap ${overCap}`,
      ),
    );

    const headings = extracted.blocks.filter((b) => b.kind === 'h2');
    append(row('headings', String(headings.length)));
    // Short paragraph blocks with no terminal punctuation likely SHOULD be
    // headings (the bold-as-title gap) — surface them.
    const suspected: string[] = [];
    for (const b of extracted.blocks) {
      if (b.kind !== 'p') continue;
      const t = extracted.text.slice(b.charStart, b.charEnd).trim();
      if (t.length > 0 && t.length <= 60 && !/[.!?:;]$/.test(t)) suspected.push(t);
    }
    append(row('suspected missed headings', String(suspected.length)));
    suspected.slice(0, 8).forEach((t) => append(`    · ${t}`));

    append('  ── spoken preview ──');
    append(extracted.text.slice(0, 700).replace(/\n{2,}/g, '\n  ¶ '));
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
          voiceRef.current!,
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
    clearPlaybackDiagnostics();
    clearNarrationPerfCounters();
    append('\nProduction playback trace reset. Open the reader and run Test 5 now.');
  };

  const reportPlaybackTrace = () => {
    const diagnostics = getPlaybackDiagnostics();
    const counters = getNarrationPerfCounters();
    const device = getDevicePerformanceSnapshot();
    const completed = diagnostics.traces.filter((trace) => trace.outcome === 'playing');
    const tapTimes = completed.flatMap((trace) => trace.playerPlayingMs == null ? [] : [trace.playerPlayingMs]);
    const queueTimes = completed.flatMap((trace) => trace.queueWaitMs == null ? [] : [trace.queueWaitMs]);
    const decisions: Record<string, number> = {};
    for (const trace of diagnostics.traces) {
      const key = trace.cacheDecision ?? 'no-decision';
      decisions[key] = (decisions[key] ?? 0) + 1;
    }
    const fastLeadChars = diagnostics.traces.flatMap((trace) => trace.fastLeadChars == null ? [] : [trace.fastLeadChars]);
    const gapTimes = diagnostics.boundaryGaps.map((gap) => gap.durationMs);
    const cachedGapTimes = diagnostics.boundaryGaps.filter((gap) => gap.nextWasCached).map((gap) => gap.durationMs);
    const missedGapTimes = diagnostics.boundaryGaps.filter((gap) => !gap.nextWasCached).map((gap) => gap.durationMs);
    const depths = diagnostics.prefetch.map((sample) => sample.depth);
    const throughputs = diagnostics.prefetch.flatMap((sample) => sample.synthThroughput == null ? [] : [sample.synthThroughput]);

    append('\n── Production reader playback ──');
    append(row('requests', `${diagnostics.traces.length} · playing ${completed.length} · cancelled ${diagnostics.traces.filter((t) => t.outcome === 'cancelled').length} · errors ${diagnostics.traces.filter((t) => t.outcome === 'error').length}`));
    append(row('cache decisions', Object.entries(decisions).map(([key, count]) => `${key}:${count}`).join('  ') || '(none)'));
    append(row('tap → playing p50/p95', tapTimes.length ? `${ms(percentile(tapTimes, 0.5))} / ${ms(percentile(tapTimes, 0.95))}` : '(no completed requests)'));
    append(row('queue wait p50/p95', queueTimes.length ? `${ms(percentile(queueTimes, 0.5))} / ${ms(percentile(queueTimes, 0.95))}` : '(no synthesis requests)'));
    append(row('fast-lead chars', fastLeadChars.length ? `median ${Math.round(percentile(fastLeadChars, 0.5))} · min ${min(fastLeadChars)} · max ${max(fastLeadChars)}` : '(none)'));
    append(row('boundary gap p50/p95', gapTimes.length ? `${ms(percentile(gapTimes, 0.5))} / ${ms(percentile(gapTimes, 0.95))} · max ${ms(max(gapTimes))}` : '(none crossed)'));
    append(row('cached boundary gaps', summarizeDurations(cachedGapTimes)));
    append(row('uncached boundary gaps', summarizeDurations(missedGapTimes)));
    append(row('prefetch depth', depths.length ? `median ${percentile(depths, 0.5)} · min ${min(depths)} · max ${max(depths)}` : '(none)'));
    append(row('synth throughput', throughputs.length ? `median ${percentile(throughputs, 0.5).toFixed(2)}× realtime` : '(not available)'));
    append(row('actual syntheses', String(counters.synthesesStarted)));
    append(row('deduplicated waits', String(counters.deduplicatedWaiters)));

    append('  ── latest request waterfalls ──');
    diagnostics.traces.slice(-10).forEach((trace) => {
      append(`  #${trace.id} ${trace.kind} · ${trace.chars}c · ${trace.cacheDecision ?? 'no decision'} · ${trace.outcome}`);
      append(`    cache ${optionalMs(trace.cacheDecisionMs)} · queue ${optionalMs(trace.queueWaitMs)} · ready ${optionalMs(trace.prepareMs)} · loaded ${optionalMs(trace.playerLoadedMs)} · playing ${optionalMs(trace.playerPlayingMs)}`);
      if (trace.synthesis) {
        append(`    synth ${ms(trace.synthesis.synthMs)} · PCM ${ms(trace.synthesis.pcmMs)} · AAC ${ms(trace.synthesis.aacMs)} · production total ${ms(trace.synthesis.totalMs)}`);
      }
    });

    append('  ── device state ──');
    if (!device) {
      append('  Native device diagnostics unavailable in this build. Rebuild the APK to enable them.');
    } else {
      append(row('thermal status', thermalStatusLabel(device.thermalStatus)));
      append(row('battery', `${optionalNumber(device.batteryPercent, '%')} · ${optionalNumber(device.batteryTemperatureC, ' °C')} · saver ${device.powerSaveMode ? 'on' : 'off'}`));
      append(row('memory available', `${formatBytes(device.availableMemoryBytes)} / ${formatBytes(device.totalMemoryBytes)} · low ${device.lowMemory ? 'yes' : 'no'}`));
      append(row('memory threshold', formatBytes(device.memoryThresholdBytes)));
      append(row('app memory class', `${device.appMemoryClassMb} MB · large ${device.largeAppMemoryClassMb} MB`));
      append(row('CPU cores', String(device.cpuCores)));
      const pressure = classifyDevicePressure(device);
      append(row('playback pressure', pressure));
      append(row('recommended prefetch', `${prefetchDepth(getSynthRtf(modelId), pressure)} clips`));
    }
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
        <DevAction
          styles={styles}
          order="Test 1"
          title="Smoke test"
          description="Synthesizes and plays one short sample. Start here to verify that the engine, voice, file output, and player all work."
          color={palette.primary}
          onPress={() => void smokeTest()}
          disabled={busy}
        />

        <Text style={styles.sectionTitle}>Choose a document</Text>
        <Text style={styles.sectionHint}>Test 2 analyzes text only. Select the large PDF and the small document separately.</Text>
        {documents.length > 0 ? (
          documents.slice(0, 12).map((document) => (
            <DevAction
              key={document.docHash}
              styles={styles}
              order="Test 2"
              title={`Analyze · ${document.title.slice(0, 28)}`}
              description={`Reports extraction, headings, chunk distribution, P95 size, and over-cap count for “${document.title}”.`}
              color={palette.primary}
              onPress={() => analyzeDoc(document)}
              disabled={busy}
            />
          ))
        ) : (
          <Text style={styles.emptyDocuments}>Import a PDF, Markdown, or DOCX document before running document-specific tests.</Text>
        )}
        {analyzedDoc ? <Text style={styles.selectedDocument}>Selected: {analyzedDoc.title}</Text> : null}

        <DevAction
          styles={styles}
          order="Test 3"
          title="Trace real synthesis"
          description={
            analyzedDoc
              ? `Deletes chunk 0 for “${analyzedDoc.title}”, then measures the complete production synthesis and native AAC path.`
              : 'Analyze a document first. This test then measures its first chunk through the production AAC path.'
          }
          color={palette.primary}
          onPress={() => void traceRealSynth()}
          disabled={busy || !analyzedDoc}
        />
        <DevAction
          styles={styles}
          order="Test 4"
          title="Run clean benchmark"
          description="Measures first-audio latency and sustained throughput before the warm-repeat stress pass heats or throttles the device."
          color={palette.primary}
          onPress={() => void runBenchmark()}
          disabled={busy}
        />
        <DevAction
          styles={styles}
          order="Test 5 · setup"
          title="Reset playback trace"
          description="Clears production playback timings. Then open the reader, play a paragraph, stop, start from its next sentence, and let playback cross at least five boundaries."
          color={palette.primary}
          onPress={resetPlaybackTrace}
          disabled={busy}
        />
        <DevAction
          styles={styles}
          order="Test 5 · report"
          title="Report playback trace"
          description="After the reader scenario, reports real cache decisions, synthesis and queue time, player startup, boundary gaps, prefetch depth, redundant work, and device state."
          color={palette.primary}
          onPress={reportPlaybackTrace}
          disabled={busy}
        />
        <DevAction
          styles={styles}
          order="Test 6"
          title={`Warm repeat ×${REPEAT_RUNS}`}
          description="Runs the repeated warm synthesis stress pass after clean measurements to expose median, P90, scheduler noise, and thermal drift."
          color={palette.primary}
          onPress={() => void repeatBenchmark()}
          disabled={busy}
        />
        <DevAction
          styles={styles}
          order="Test 7 · run last"
          title="Cold load"
          description="Releases the resident ONNX sessions and times a complete reload. Run last because it intentionally destroys the warm baseline."
          color={palette.primary}
          onPress={() => void coldLoad()}
          disabled={busy}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Results</Text>
        <Text style={styles.sectionHint}>Copy the log before clearing it. The console itself scrolls independently.</Text>
        <DevAction
          styles={styles}
          order="Test 8 · export"
          title="Copy results"
          description="Copies the entire measurement log to the clipboard so it can be saved or compared with another build."
          color={palette.primary}
          onPress={() => void copyResults()}
        />
        <DevAction
          styles={styles}
          order="Utility"
          title="Clear results"
          description="Clears only the visible developer log. It does not remove model files or the narration cache."
          color={palette.danger}
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

const sleep = (msVal: number) => new Promise<void>((r) => setTimeout(r, msVal));
const seconds = (msVal: number) => (msVal / 1000).toFixed(2);
const ms = (msVal: number) => `${Math.round(msVal)} ms`;
const row = (label: string, value: string) => `  ${label.padEnd(20)} ${value}`;
const describe = (error: unknown) => (error instanceof Error ? error.message : String(error));
const requireValue = <T,>(value: T | null | undefined, message: string): T => {
  if (value == null) throw new Error(message);
  return value;
};
const firstAudioMsFor = (result: ChunkBench) => result.synthMs + result.encodeMs + result.writeMs;
const standardRtf = (wallMs: number, audioSec: number) => wallMs / 1000 / Math.max(0.001, audioSec);
const throughput = (wallMs: number, audioSec: number) => audioSec / Math.max(0.001, wallMs / 1000);
const percent = (part: number, total: number) => `${((part / Math.max(1, total)) * 100).toFixed(1)}%`;
const min = (values: number[]) => Math.min(...values);
const max = (values: number[]) => Math.max(...values);
const optionalMs = (value: number | null) => value == null ? '—' : ms(value);
const optionalNumber = (value: number | null, suffix: string) => value == null ? 'unknown' : `${value.toFixed(1)}${suffix}`;

const THERMAL_STATUS = ['none', 'light', 'moderate', 'severe', 'critical', 'emergency', 'shutdown'] as const;

function thermalStatusLabel(status: number | null): string {
  if (status == null) return 'unavailable (Android < 10)';
  return THERMAL_STATUS[status] ?? `unknown (${status})`;
}

function summarizeDurations(values: number[]): string {
  if (values.length === 0) return '(none)';
  return `${values.length} · p50 ${ms(percentile(values, 0.5))} · p95 ${ms(percentile(values, 0.95))}`;
}

function percentile(values: number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1));
  return sorted[index];
}

function stageRow(label: string, durationMs: number, totalMs: number, detail?: string): string {
  const suffix = detail ? ` · ${detail}` : '';
  return row(label, `${ms(durationMs)} · ${percent(durationMs, totalMs)}${suffix}`);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatProductionMetrics(metrics: NarrationSynthesisMetrics): string {
  return [
    stageRow('ONNX synth', metrics.synthMs, metrics.totalMs),
    stageRow('PCM conversion (native)', metrics.pcmMs, metrics.totalMs),
    stageRow('AAC encoding', metrics.aacMs, metrics.totalMs),
    row('audio length', `${metrics.audioSec.toFixed(2)} s (predicted ${metrics.predictedSec.toFixed(2)} s)`),
    row('tokens / samples', `${metrics.tokenCount} / ${metrics.waveformSamples.toLocaleString()}`),
    row('latent dim × len', `${metrics.latentDim} × ${metrics.latentLen}`),
    row('AAC output', formatBytes(metrics.outputBytes)),
    row('tone', `${metrics.requestedTone} → ${metrics.resolvedTone} · synth speed ×${metrics.synthesisSpeed.toFixed(2)}`),
    row('cadence', `${metrics.prosodyBoundary} · ${metrics.trailingPauseMs} ms trailing pause`),
    row('standard RTF', standardRtf(metrics.totalMs, metrics.audioSec).toFixed(3)),
    row('throughput', `${throughput(metrics.totalMs, metrics.audioSec).toFixed(2)}× realtime`),
  ].join('\n');
}

// A time-ordered waterfall of tracer spans: start offset, duration (or "mark").
function formatTrace(spans: Span[]): string {
  if (spans.length === 0) return '  (no trace captured)';
  return spans
    .slice()
    .sort((a, b) => a.startMs - b.startMs)
    .map((s) => {
      const dur = s.endMs - s.startMs;
      const at = `${Math.round(s.startMs)}`.padStart(6);
      return `  @${at}ms  ${dur > 0 ? `+${Math.round(dur)}ms`.padEnd(8) : 'mark    '}${s.label}`;
    })
    .join('\n');
}

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
  getVoice,
  isEngineResident,
  loadChunks,
  qualityProfile,
  releaseCurrentEngine,
  TextToSpeech,
  VoiceStyle,
  type NarrationSettings,
  type NarrationSynthesisMetrics,
  type SynthesisDiagnostics,
  type SynthesisStage,
} from '../../supertonic';
import { loadExtractedText } from '../../pdf';
import { usePlaybackContext } from '../../playback';
import { useDocumentsStore, useSettingsStore } from '../../stores';
import { maxChunkLen } from '../../supertonic/text/sentenceRules';
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
  const documents = useDocumentsStore((s) => s.documents);
  const { clearActiveDoc } = usePlaybackContext();

  const [log, setLog] = useState('Voice engine performance lab.\n');
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState(settingsSteps);
  const [analyzedDoc, setAnalyzedDoc] = useState<ImportedDocument | null>(null);
  const ttsRef = useRef<TextToSpeech | null>(null);
  const voiceRef = useRef<VoiceStyle | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);

  const append = (line: string) => {
    console.log('[tts-perf]', line);
    setLog((prev) => prev + line + '\n');
  };

  // First use pays the genuine cold-load cost; later runs reuse it (warm).
  const ensureLoaded = async () => {
    if (!modelId) throw new Error('No voice model selected — pick one in Settings → Voice model.');
    const v = voiceId || DEFAULT_VOICE;
    if (isEngineResident(modelId) && ttsRef.current && voiceRef.current) {
      append('Sessions already loaded (warm) — skipping cold load.');
      return;
    }
    append(`Cold-loading ONNX sessions (${modelId}, voice ${v})...`);
    const start = Date.now();
    // Shared engine — reuses playback's resident sessions, no second copy.
    ttsRef.current = await getEngine(modelId);
    voiceRef.current = await getVoice(modelId, v);
    append(`  sessions loaded in ${seconds(Date.now() - start)} s  (sampleRate=${ttsRef.current.sampleRate}).`);
  };

  // Synthesize one chunk, capturing per-stage + encode/write timings and writing
  // the WAV so it can be played later. Does not play.
  const benchChunk = async (text: string): Promise<ChunkBench> => {
    const tts = ttsRef.current!;
    const voice = voiceRef.current!;
    const stages: Record<string, number> = {};
    const stepStarts: number[] = [];
    let last = Date.now();
    const synthStart = last;

    const { waveform, durationsSec, diagnostics } = await tts.synthesize(
      text,
      lang,
      voice,
      steps,
      1.0, // neutral rate, matching the real cache path
      () => stepStarts.push(Date.now()),
      (stage) => {
        const now = Date.now();
        stages[stage] = now - last;
        last = now;
        traceMark(stage);
      },
    );
    const synthMs = Date.now() - synthStart;

    const encStart = Date.now();
    const bytes = encodeWav(waveform, tts.sampleRate);
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
      audioSec: waveform.length / tts.sampleRate,
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
      traceStart();
      const start = Date.now();
      ttsRef.current = await getEngine(selectedModelId);
      voiceRef.current = await getVoice(selectedModelId, voiceId || DEFAULT_VOICE);
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
      const settings: NarrationSettings = { modelId: selectedModelId, voiceId: voiceId || DEFAULT_VOICE, speed: 1, steps, lang, quality };
      // Force a fresh synth so there's something to trace (not a cache hit).
      try {
        const f = new File(chunkAudioUri(analyzedDoc.docHash, firstChunk.charStart, settings));
        if (f.exists) f.delete();
      } catch {}
      append(`\n── Real synth path · chunk 0 (${firstChunk.text.length}c) ──`);
      append(row('configuration', `${modelId} · voice ${voiceId || DEFAULT_VOICE} · lang ${lang} · steps ${steps} · ${quality} · unit ${qualityProfile(quality).unitLen}`));
      traceStart();
      const t0 = Date.now();
      let metrics: NarrationSynthesisMetrics | null = null;
      await ensureChunkAudio(
        ttsRef.current!,
        voiceRef.current!,
        analyzedDoc.docHash,
        firstChunk,
        settings,
        (reported) => { metrics = reported; },
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Aloud — performance lab</Text>
      <Text style={styles.hint}>
        Install the voice in Settings → voice model first. Uses the selected voice ({voiceId || DEFAULT_VOICE}) and language ({lang}).
      </Text>
      <View style={styles.row}>
        <Button title="- steps" onPress={() => setSteps((s) => Math.max(1, s - 1))} disabled={busy} />
        <Text style={styles.steps}>steps: {steps}</Text>
        <Button title="+ steps" onPress={() => setSteps((s) => s + 1)} disabled={busy} />
      </View>
      <View style={styles.row}>
        <Button title="Run benchmark" onPress={runBenchmark} disabled={busy} />
        <Button title={`Repeat ×${REPEAT_RUNS}`} onPress={repeatBenchmark} disabled={busy} />
        <Button title="Smoke test" onPress={smokeTest} disabled={busy} />
        <Button title="Cold load" onPress={coldLoad} disabled={busy} />
      </View>
      <View style={styles.row}>
        <Button title="Copy results" onPress={() => void copyResults()} />
        <Button title="Clear" onPress={() => setLog('')} disabled={busy} />
      </View>
      {documents.length > 0 ? (
        <View>
          <Text style={styles.hint}>Analyze extraction / trace real synth for a document:</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            {documents.slice(0, 12).map((d) => (
              <Button key={d.docHash} title={d.title.slice(0, 18)} onPress={() => analyzeDoc(d)} disabled={busy} />
            ))}
          </View>
          <View style={styles.row}>
            <Button title={`Trace real synth${analyzedDoc ? ` · ${analyzedDoc.title.slice(0, 12)}` : ''}`} onPress={() => void traceRealSynth()} disabled={busy || !analyzedDoc} />
          </View>
        </View>
      ) : null}
      <ScrollView style={styles.logBox}>
        <Text selectable style={styles.logText}>{log}</Text>
      </ScrollView>
    </View>
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

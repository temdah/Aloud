// Synthesize a chunk and cache its audio as AAC (.m4a). Imports engine pieces
// directly (not the src/supertonic barrel) to avoid a circular dependency.
import type { Chunk, SentenceAnchor } from '../../types';
import type { TextToSpeech } from '../synthesis/textToSpeech';
import type { VoiceStyle } from '../synthesis/voiceStyle';
import type { File } from 'expo-file-system';
import { encodeFloatPcmToM4a } from '../../../modules/aac-codec';
import { stageTimer, traceMark, traceOpen } from '../../utils';
import {
  chunkAudioFile,
  leadAudioFile,
  MIN_CACHED_BYTES,
  recordCachedProfile,
  recordSentenceCachedProfile,
  sentenceAudioFile,
  writeChunkTiming,
  writeSentenceTiming,
} from './audioCache';
import type { NarrationMetricsReporter, NarrationSettings, NarrationSynthesisMetrics } from './narrationTypes';
import { recordDeduplicatedSynthesis, recordSynthesisStarted, recordSynthRtf } from './perfStats';
import { planProsody } from './prosodyPlanner';
import type { ProsodyPlan } from './prosodyTypes';
import { silenceSampleCount } from './silenceSamples';
import { normalizeSynthesisSteps } from '../qualityProfile';
import { isAcademicDocument, planNarrationTone } from './tonePlanner';

// Coalesce concurrent synthesis of the same clip. Without this, a chunk being
// prefetched in the background and then reached by playback runs TWO full ONNX
// pipelines over the same text at once (halving throughput, racing the same file
// write). Keyed by the output uri, which already encodes doc + charStart +
// settings, so only truly-identical clips collapse.
const inFlight = new Map<string, Promise<string>>();
const academicDocuments = new Map<string, boolean>();
const MAX_ACADEMIC_DOCUMENTS = 16;

function academicDocument(docHash: string, documentText: string): boolean {
  const key = `${docHash}:${documentText.length}`;
  const cached = academicDocuments.get(key);
  if (cached !== undefined) {
    academicDocuments.delete(key);
    academicDocuments.set(key, cached);
    return cached;
  }
  const result = isAcademicDocument(documentText);
  if (academicDocuments.size >= MAX_ACADEMIC_DOCUMENTS) {
    const oldest = academicDocuments.keys().next().value;
    if (oldest) academicDocuments.delete(oldest);
  }
  academicDocuments.set(key, result);
  return result;
}

function academicContext(settings: NarrationSettings, docHash: string, documentText: string): boolean {
  return settings.tone === 'adaptive' && academicDocument(docHash, documentText);
}

function dedupeSynth(key: string, run: () => Promise<string>): Promise<string> {
  const existing = inFlight.get(key);
  if (existing) {
    recordDeduplicatedSynthesis();
    return existing;
  }
  const p = run().finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

function planChunkProsody(documentText: string, chunk: Pick<Chunk, 'text' | 'charStart' | 'charEnd'>): ProsodyPlan {
  const sourceMatches =
    chunk.charEnd <= documentText.length &&
    documentText.slice(chunk.charStart, chunk.charEnd).trim() === chunk.text.trim();
  return sourceMatches
    ? planProsody(documentText, chunk.charStart, chunk.charEnd)
    : planProsody(chunk.text, 0, chunk.text.length);
}

async function synthesizeToFile(
  tts: TextToSpeech,
  voice: VoiceStyle,
  file: File,
  unit: ProsodyPlan,
  settings: NarrationSettings,
  academic: boolean,
): Promise<{ uri: string; neutralSec: number; metrics: NarrationSynthesisMetrics }> {
  recordSynthesisStarted();
  // Render at the engine's neutral rate; playback speed is applied live, so the
  // cache is speed-agnostic.
  const timer = stageTimer('synth');
  const endClip = traceOpen(`synth·${unit.synthesisText.length}c`);
  const wallStart = Date.now();
  const onStage = (stage: string) => {
    timer.mark(stage);
    traceMark(stage);
  };
  const synthStart = Date.now();
  const tone = planNarrationTone('', unit.synthesisText, settings.tone, academic);
  const steps = normalizeSynthesisSteps(settings.steps);
  const { waveform, diagnostics } = await tts.synthesize(unit.synthesisText, settings.lang, voice, steps, tone.synthesisSpeed, undefined, onStage);
  const synthMs = Date.now() - synthStart;
  const trailingPauseMs = Math.round(unit.trailingPauseMs * tone.pauseScale);
  const trailingSilenceSamples = silenceSampleCount(tts.sampleRate, trailingPauseMs);
  // Fuse Float32 -> PCM16 and the planned silence tail into the native AAC worker
  // so JavaScript never copies the full waveform just to add a pause.
  if (file.exists) file.delete();
  const postprocessStart = Date.now();
  const encoded = await encodeFloatPcmToM4a(waveform, tts.sampleRate, file.uri, 64000, trailingSilenceSamples);
  const postprocessMs = Date.now() - postprocessStart;
  const pcmMs = encoded.pcmMs;
  const aacMs = Math.max(0, postprocessMs - pcmMs);
  timer.mark('native-float-to-aac');
  traceMark('native-float-to-aac');
  endClip();
  const pauseSec = trailingPauseMs / 1000;
  const outputSamples = waveform.length + trailingSilenceSamples;
  const audioSec = outputSamples / tts.sampleRate;
  const totalMs = Date.now() - wallStart;
  const wallSec = totalMs / 1000;
  if (wallSec > 0) recordSynthRtf(settings.modelId, audioSec / wallSec); // sensor for the perf tip
  if (__DEV__) {
    console.log(`[perf:synth] audio ${audioSec.toFixed(2)}s / wall ${wallSec.toFixed(2)}s = ${(audioSec / wallSec).toFixed(2)}x realtime`);
  }
  timer.done();
  return {
    uri: file.uri,
    neutralSec: audioSec,
    metrics: {
      ...diagnostics,
      predictedSec: diagnostics.predictedSec + pauseSec,
      audioSec,
      waveformSamples: outputSamples,
      synthMs,
      pcmMs,
      aacMs,
      totalMs,
      outputBytes: file.size ?? 0,
      requestedTone: tone.requested,
      resolvedTone: tone.resolved,
      synthesisSpeed: tone.synthesisSpeed,
      trailingPauseMs,
      prosodyBoundary: unit.boundary,
    },
  };
}

export async function ensureChunkAudio(
  tts: TextToSpeech,
  voice: VoiceStyle,
  docHash: string,
  documentText: string,
  chunk: Chunk,
  settings: NarrationSettings,
  onMetrics?: NarrationMetricsReporter,
): Promise<string> {
  // Register on hits too, so caches made before the registry get labelled on replay.
  recordCachedProfile(docHash, settings);

  const file = chunkAudioFile(docHash, chunk.charStart, settings);
  if (file.exists && file.size > MIN_CACHED_BYTES) return file.uri;

  return dedupeSynth(file.uri, async () => {
    if (file.exists && file.size > MIN_CACHED_BYTES) return file.uri; // landed while queued
    const prosody = planChunkProsody(documentText, chunk);
    const { uri, neutralSec, metrics } = await synthesizeToFile(tts, voice, file, prosody, settings, academicContext(settings, docHash, documentText));
    // Persist the clip length so the document timeline can rebuild from cache.
    writeChunkTiming(docHash, chunk.charStart, settings, neutralSec);
    onMetrics?.(metrics);
    return uri;
  });
}

// Short first-sentence "fast lead" so playback starts in ~1 s. Keyed by length in
// the OS cache dir so it never aliases the canonical per-chunk cache.
export async function ensureLeadAudio(
  tts: TextToSpeech,
  voice: VoiceStyle,
  docHash: string,
  documentText: string,
  chunk: Chunk,
  settings: NarrationSettings,
  onMetrics?: NarrationMetricsReporter,
): Promise<string> {
  const file = leadAudioFile(docHash, chunk.charStart, chunk.text.length, settings);
  if (file.exists && file.size > MIN_CACHED_BYTES) return file.uri;
  return dedupeSynth(file.uri, async () => {
    if (file.exists && file.size > MIN_CACHED_BYTES) return file.uri;
    const prosody = planChunkProsody(documentText, chunk);
    const { uri, metrics } = await synthesizeToFile(tts, voice, file, prosody, settings, academicContext(settings, docHash, documentText));
    onMetrics?.(metrics);
    return uri;
  });
}

export async function ensureSentenceAudio(
  tts: TextToSpeech,
  voice: VoiceStyle,
  docHash: string,
  documentText: string,
  anchor: SentenceAnchor,
  settings: NarrationSettings,
  onMetrics?: NarrationMetricsReporter,
): Promise<string> {
  recordSentenceCachedProfile(docHash, settings);
  const file = sentenceAudioFile(docHash, anchor, settings);
  if (file.exists && file.size > MIN_CACHED_BYTES) return file.uri;

  return dedupeSynth(file.uri, async () => {
    if (file.exists && file.size > MIN_CACHED_BYTES) return file.uri;
    const prosody = planProsody(documentText, anchor.charStart, anchor.charEnd);
    const { uri, neutralSec, metrics } = await synthesizeToFile(tts, voice, file, prosody, settings, academicContext(settings, docHash, documentText));
    writeSentenceTiming(docHash, anchor, settings, neutralSec);
    onMetrics?.(metrics);
    return uri;
  });
}

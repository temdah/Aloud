// Synthesize a chunk and cache its audio as AAC (.m4a). Imports engine pieces
// directly (not the src/supertonic barrel) to avoid a circular dependency.
import type { Chunk } from '../../types';
import type { TextToSpeech } from '../synthesis/textToSpeech';
import type { VoiceStyle } from '../synthesis/voiceStyle';
import type { File } from 'expo-file-system';
import { encodePcmToM4a } from '../../../modules/aac-codec';
import { stageTimer } from '../../utils/perf';
import { chunkAudioFile, leadAudioFile, MIN_CACHED_BYTES, recordCachedProfile, writeChunkTiming } from './audioCache';
import type { NarrationSettings } from './narrationTypes';
import { recordSynthRtf } from './perfStats';

// Coalesce concurrent synthesis of the same clip. Without this, a chunk being
// prefetched in the background and then reached by playback runs TWO full ONNX
// pipelines over the same text at once (halving throughput, racing the same file
// write). Keyed by the output uri, which already encodes doc + charStart +
// settings, so only truly-identical clips collapse.
const inFlight = new Map<string, Promise<string>>();

function dedupeSynth(key: string, run: () => Promise<string>): Promise<string> {
  const existing = inFlight.get(key);
  if (existing) return existing;
  const p = run().finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

async function synthesizeToFile(
  tts: TextToSpeech,
  voice: VoiceStyle,
  file: File,
  chunk: Chunk,
  settings: NarrationSettings,
): Promise<{ uri: string; neutralSec: number }> {
  // Render at the engine's neutral rate; playback speed is applied live, so the
  // cache is speed-agnostic.
  const timer = stageTimer('synth');
  const wallStart = Date.now();
  const { waveform } = await tts.synthesize(chunk.text, settings.lang, voice, settings.steps, 1.0, undefined, timer.mark);
  // Float [-1,1] -> 16-bit LE PCM, byte-identical to the old WAV path, so the
  // cache is unchanged (SYNTH_VERSION stays put).
  const pcm = new Int16Array(waveform.length);
  for (let i = 0; i < waveform.length; i++) {
    const clamped = Math.max(-1, Math.min(1, waveform[i]));
    pcm[i] = Math.floor(clamped * 32767);
  }
  timer.mark('pcm-convert');
  if (file.exists) file.delete();
  await encodePcmToM4a(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength), tts.sampleRate, file.uri);
  timer.mark('aac-encode');
  const audioSec = waveform.length / tts.sampleRate;
  const wallSec = (Date.now() - wallStart) / 1000;
  if (wallSec > 0) recordSynthRtf(settings.modelId, audioSec / wallSec); // sensor for the perf tip
  if (__DEV__) {
    console.log(`[perf:synth] audio ${audioSec.toFixed(2)}s / wall ${wallSec.toFixed(2)}s = ${(audioSec / wallSec).toFixed(2)}x realtime`);
  }
  timer.done();
  return { uri: file.uri, neutralSec: waveform.length / tts.sampleRate };
}

export async function ensureChunkAudio(
  tts: TextToSpeech,
  voice: VoiceStyle,
  docHash: string,
  chunk: Chunk,
  settings: NarrationSettings,
): Promise<string> {
  // Register on hits too, so caches made before the registry get labelled on replay.
  recordCachedProfile(docHash, settings);

  const file = chunkAudioFile(docHash, chunk.charStart, settings);
  if (file.exists && file.size > MIN_CACHED_BYTES) return file.uri;

  return dedupeSynth(file.uri, async () => {
    if (file.exists && file.size > MIN_CACHED_BYTES) return file.uri; // landed while queued
    const { uri, neutralSec } = await synthesizeToFile(tts, voice, file, chunk, settings);
    // Persist the clip length so the document timeline can rebuild from cache.
    writeChunkTiming(docHash, chunk.charStart, settings, neutralSec);
    return uri;
  });
}

// Short first-sentence "fast lead" so playback starts in ~1 s. Keyed by length in
// the OS cache dir so it never aliases the canonical per-chunk cache.
export async function ensureLeadAudio(
  tts: TextToSpeech,
  voice: VoiceStyle,
  docHash: string,
  chunk: Chunk,
  settings: NarrationSettings,
): Promise<string> {
  const file = leadAudioFile(docHash, chunk.charStart, chunk.text.length, settings);
  if (file.exists && file.size > MIN_CACHED_BYTES) return file.uri;
  return dedupeSynth(file.uri, async () => {
    if (file.exists && file.size > MIN_CACHED_BYTES) return file.uri;
    const { uri } = await synthesizeToFile(tts, voice, file, chunk, settings);
    return uri;
  });
}

// Imports engine pieces directly (NOT the src/supertonic barrel) so narration
// can be re-exported from that barrel without a circular dependency.
import type { Chunk } from '../../types';
import type { TextToSpeech } from '../synthesis/textToSpeech';
import type { VoiceStyle } from '../synthesis/voiceStyle';
import type { File } from 'expo-file-system';
import { encodePcmToM4a } from '../../../modules/aac-codec';
import { stageTimer } from '../../utils/perf';
import { chunkAudioFile, leadAudioFile, MIN_CACHED_BYTES, recordCachedProfile } from './audioCache';
import type { NarrationSettings } from './narrationTypes';

// Synthesize `chunk`, encode it to AAC (.m4a) at `file`, and return the file uri.
// Shared by the persistent per-chunk cache and the ephemeral fast-lead cache.
// The model emits float PCM; we convert to 16-bit and hand the bytes straight to
// Android's MediaCodec (native aac-codec) — no temp WAV, no disk round-trip.
async function synthesizeToFile(
  tts: TextToSpeech,
  voice: VoiceStyle,
  file: File,
  chunk: Chunk,
  settings: NarrationSettings,
): Promise<string> {
  // Render at the engine's neutral rate (1.0); the desired playback speed is
  // applied live via the player's playback rate, so the cache is speed-agnostic.
  const timer = stageTimer('synth');
  const { waveform } = await tts.synthesize(chunk.text, settings.lang, voice, settings.steps, 1.0, undefined, timer.mark);
  // Float [-1,1] -> 16-bit LE PCM, byte-identical to the old WAV path (same
  // clamp/floor), so the encoder input — and cache — is unchanged.
  const pcm = new Int16Array(waveform.length);
  for (let i = 0; i < waveform.length; i++) {
    const clamped = Math.max(-1, Math.min(1, waveform[i]));
    pcm[i] = Math.floor(clamped * 32767);
  }
  timer.mark('pcm-convert');
  if (file.exists) file.delete();
  await encodePcmToM4a(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength), tts.sampleRate, file.uri);
  timer.mark('aac-encode');
  if (__DEV__) {
    const audioSec = waveform.length / tts.sampleRate;
    const wallSec = timer.elapsedMs() / 1000;
    console.log(`[perf:synth] audio ${audioSec.toFixed(2)}s / wall ${wallSec.toFixed(2)}s = ${(audioSec / wallSec).toFixed(2)}x realtime`);
  }
  timer.done();
  return file.uri;
}

// Returns a playable file:// uri for a chunk's audio, synthesizing + caching it
// on a cache miss (keyed by the chunk's charStart + settings). Idempotent —
// used for both the active chunk and generate-ahead prefetch.
//
// Word-level Map B (timing.json) is NOT produced yet: the engine exposes only a
// total duration, not per-word timings, so the player highlights at chunk level
// (the design's sanctioned fallback). When per-word durations are available,
// write them via chunkTimingFile here.
export async function ensureChunkAudio(
  tts: TextToSpeech,
  voice: VoiceStyle,
  docHash: string,
  chunk: Chunk,
  settings: NarrationSettings,
): Promise<string> {
  // Register this profile so the "manage cached audio" UI can label the voice.
  // Done on hits too, so caches made before the registry get picked up on replay.
  recordCachedProfile(docHash, settings);

  const file = chunkAudioFile(docHash, chunk.charStart, settings);
  if (file.exists && file.size > MIN_CACHED_BYTES) return file.uri;

  return synthesizeToFile(tts, voice, file, chunk, settings);
}

// Synthesizes (or reuses) a short ephemeral "fast lead" clip so playback can
// start within ~1 s instead of waiting for a full chunk. Stored in the OS cache
// dir, keyed by (charStart, text length) so it never aliases the canonical
// per-chunk cache. NOT registered as a profile — leads are disposable.
export async function ensureLeadAudio(
  tts: TextToSpeech,
  voice: VoiceStyle,
  docHash: string,
  chunk: Chunk,
  settings: NarrationSettings,
): Promise<string> {
  const file = leadAudioFile(docHash, chunk.charStart, chunk.text.length, settings);
  if (file.exists && file.size > MIN_CACHED_BYTES) return file.uri;
  return synthesizeToFile(tts, voice, file, chunk, settings);
}

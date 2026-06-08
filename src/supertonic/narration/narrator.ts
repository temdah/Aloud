// Imports engine pieces directly (NOT the src/supertonic barrel) so narration
// can be re-exported from that barrel without a circular dependency.
import type { Chunk } from '../../types';
import { encodeWav } from '../synthesis/wavEncoder';
import type { TextToSpeech } from '../synthesis/textToSpeech';
import type { VoiceStyle } from '../synthesis/voiceStyle';
import { File } from 'expo-file-system';
import { chunkWavFile, leadWavFile, recordCachedProfile } from './audioCache';
import type { NarrationSettings } from './narrationTypes';

const WAV_HEADER_BYTES = 44;

// Synthesize `chunk` and write its WAV to `file`, returning the file uri. Shared
// by the persistent per-chunk cache and the ephemeral fast-lead cache.
async function synthesizeToFile(
  tts: TextToSpeech,
  voice: VoiceStyle,
  file: File,
  chunk: Chunk,
  settings: NarrationSettings,
): Promise<string> {
  // Render at the engine's neutral rate (1.0); the desired playback speed is
  // applied live via the player's playback rate, so the cache is speed-agnostic.
  const { waveform } = await tts.synthesize(chunk.text, settings.lang, voice, settings.steps, 1.0);
  const bytes = encodeWav(waveform, tts.sampleRate);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
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

  const file = chunkWavFile(docHash, chunk.charStart, settings);
  if (file.exists && file.size > WAV_HEADER_BYTES) return file.uri;

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
  const file = leadWavFile(docHash, chunk.charStart, chunk.text.length, settings);
  if (file.exists && file.size > WAV_HEADER_BYTES) return file.uri;
  return synthesizeToFile(tts, voice, file, chunk, settings);
}

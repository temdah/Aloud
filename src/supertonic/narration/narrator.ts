// Imports engine pieces directly (NOT the src/supertonic barrel) so narration
// can be re-exported from that barrel without a circular dependency.
import type { Chunk } from '../../types';
import { encodeWav } from '../synthesis/wavEncoder';
import type { TextToSpeech } from '../synthesis/textToSpeech';
import type { VoiceStyle } from '../synthesis/voiceStyle';
import { chunkWavFile, recordCachedProfile } from './audioCache';
import type { NarrationSettings } from './narrationTypes';

const WAV_HEADER_BYTES = 44;

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

  // Render at the engine's neutral rate (1.0); the desired playback speed is
  // applied live via the player's playback rate, so the cache is speed-agnostic.
  const { waveform } = await tts.synthesize(chunk.text, settings.lang, voice, settings.steps, 1.0);
  const bytes = encodeWav(waveform, tts.sampleRate);

  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
  return file.uri;
}

// Imports engine pieces directly (NOT the src/supertonic barrel) so narration
// can be re-exported from that barrel without a circular dependency.
import type { Chunk } from '../../types';
import { encodeWav } from '../synthesis/wavEncoder';
import type { TextToSpeech } from '../synthesis/textToSpeech';
import type { VoiceStyle } from '../synthesis/voiceStyle';
import { Directory, File, Paths } from 'expo-file-system';
import { encodeWavsToM4a } from '../../../modules/aac-codec';
import { chunkAudioFile, leadAudioFile, MIN_CACHED_BYTES, recordCachedProfile } from './audioCache';
import type { NarrationSettings } from './narrationTypes';

// Scratch dir for the transient WAV handed to the AAC encoder (OS cache, evictable).
function encodeTempFile(name: string): File {
  const dir = new Directory(Paths.cache, 'tts-enc');
  if (!dir.exists) dir.create({ intermediates: true });
  return new File(dir, name);
}

// Synthesize `chunk`, encode it to AAC (.m4a) at `file`, and return the file uri.
// Shared by the persistent per-chunk cache and the ephemeral fast-lead cache.
// The model emits float PCM; we write a throwaway WAV and let Android's MediaCodec
// (the native aac-codec module) compress it — there is no pure-JS AAC encoder.
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

  const baseName = file.uri.split('/').pop() ?? 'clip';
  const tmp = encodeTempFile(`${baseName}.wav`);
  try {
    if (tmp.exists) tmp.delete();
    tmp.create();
    tmp.write(bytes);
    if (file.exists) file.delete();
    await encodeWavsToM4a([tmp.uri], file.uri);
  } finally {
    try {
      if (tmp.exists) tmp.delete();
    } catch {}
  }
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

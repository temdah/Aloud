// Imports engine pieces directly (NOT the src/supertonic barrel) so narration
// can be re-exported from that barrel without a circular dependency.
import type { Chunk } from '../../types';
import type { TextToSpeech } from '../synthesis/textToSpeech';
import type { VoiceStyle } from '../synthesis/voiceStyle';
import { isChunkCached } from './audioCache';
import { ensureChunkAudio } from './narrator';
import type { NarrationSettings } from './narrationTypes';

export type PrerenderProgress = { done: number; total: number };

export type PrerenderResult = { completed: boolean; done: number };

export type PrerenderOptions = {
  tts: TextToSpeech;
  voice: VoiceStyle;
  docHash: string;
  chunks: Chunk[];
  settings: NarrationSettings;
  onProgress?: (p: PrerenderProgress) => void;
  /** Polled before each chunk; return true to stop early (cooperative cancel). */
  shouldCancel?: () => boolean;
};

// Walks every chunk for a document and ensures its audio is in the per-chunk
// cache the live player reads — the "process entire book" / full-audiobook job
// (§14 Phase 1), so playback never waits. Idempotent: chunks already cached for
// these settings count as instant progress and are skipped, so a cancelled run
// resumes cheaply.
export async function prerenderDocument({
  tts,
  voice,
  docHash,
  chunks,
  settings,
  onProgress,
  shouldCancel,
}: PrerenderOptions): Promise<PrerenderResult> {
  const total = chunks.length;
  let done = 0;
  onProgress?.({ done, total });
  for (const chunk of chunks) {
    if (shouldCancel?.()) return { completed: false, done };
    if (!isChunkCached(docHash, chunk.charStart, settings)) {
      await ensureChunkAudio(tts, voice, docHash, chunk, settings);
    }
    done += 1;
    onProgress?.({ done, total });
  }
  return { completed: true, done };
}

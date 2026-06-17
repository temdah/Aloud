// Imports engine pieces directly (NOT the src/supertonic barrel) so narration
// can be re-exported from that barrel without a circular dependency.
import type { Chunk } from '../../types';
import type { TextToSpeech } from '../synthesis/textToSpeech';
import type { VoiceStyle } from '../synthesis/voiceStyle';
import { concatM4a } from '../../../modules/aac-codec';
import { audiobookFile, chunkAudioFile, isAudiobookCached, isChunkCached } from './audioCache';
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

// Walks every chunk for a document, ensures its audio is cached, then stitches
// the whole book into a single `.m4a` and drops the per-chunk clips — the
// "process entire book" / full-audiobook job. We always favour the fully-cached
// single file, so once it exists the per-chunk cache is redundant. Idempotent:
// if the audiobook file already exists this returns immediately (cheap resume),
// and a cancelled run keeps whatever per-chunk clips it produced.
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

  // Already stitched (per-chunk clips are gone) — nothing to do.
  if (isAudiobookCached(docHash, settings)) {
    onProgress?.({ done: total, total });
    return { completed: true, done: total };
  }

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

  // Every chunk is cached → stitch them into one audiobook file, then delete the
  // per-chunk clips. Concat failure is non-fatal: the per-chunk cache stays and
  // playback falls back to it, so a later run can retry the stitch.
  if (chunks.length > 0) {
    try {
      const parts = chunks.map((c) => chunkAudioFile(docHash, c.charStart, settings));
      if (parts.every((f) => f.exists)) {
        await concatM4a(parts.map((f) => f.uri), audiobookFile(docHash, settings).uri);
        if (isAudiobookCached(docHash, settings)) {
          for (const f of parts) {
            try {
              f.delete();
            } catch {}
          }
        }
      }
    } catch (e) {
      console.warn('[prerender] audiobook concat failed; keeping per-chunk cache:', e);
    }
  }

  return { completed: true, done };
}

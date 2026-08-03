// Renders every chunk's audio, then stitches the book into one .m4a and drops the
// per-chunk clips. Idempotent — returns early
// if the stitched file already exists; a cancelled run keeps its per-chunk clips.
import type { Chunk } from '../../types';
import { concatM4a } from '../../../modules/aac-codec';
import { audiobookFile, chunkAudioFile, isAudiobookCached, isChunkCached, writeAudiobookIndex } from './audioCache';
import type { NarrationSettings } from './narrationTypes';
import type { PrerenderOptions, PrerenderResult } from './prerenderTypes';

export async function prerenderDocument({
  docHash,
  chunks,
  settings,
  ensureAudio,
  onProgress,
  shouldCancel,
}: PrerenderOptions): Promise<PrerenderResult> {
  const total = chunks.length;

  if (isAudiobookCached(docHash, settings)) {
    onProgress?.({ done: total, total });
    return { completed: true, done: total };
  }

  let done = 0;
  onProgress?.({ done, total });
  for (const chunk of chunks) {
    if (shouldCancel?.()) return { completed: false, done };
    if (!isChunkCached(docHash, chunk.charStart, settings)) {
      await ensureAudio(chunk);
    }
    done += 1;
    onProgress?.({ done, total });
  }

  // Stitch, then delete the per-chunk clips. Concat failure is non-fatal — the
  // per-chunk cache stays and a later run retries.
  if (chunks.length > 0) {
    try {
      const parts = chunks.map((c) => chunkAudioFile(docHash, c.charStart, settings));
      if (parts.every((f) => f.exists)) {
        const startsMs = await concatM4a(parts.map((f) => f.uri), audiobookFile(docHash, settings).uri);
        if (isAudiobookCached(docHash, settings)) {
          // Real chunk offsets for the timeline (not predicted durations).
          if (startsMs.length === chunks.length) {
            writeAudiobookIndex(docHash, settings, startsMs.map((ms) => ms / 1000));
          }
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

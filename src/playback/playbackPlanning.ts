import { findChunkIndexForOffset } from '../supertonic';
import { firstSentenceEnd } from '../supertonic/text/segmentation';
import type { Chunk } from '../types';
import { stableHash } from '../utils';
import type { FastStart, Lead } from './playbackPlanningTypes';

const PREFETCH_AHEAD = 4;
const MIN_LEAD = 140;
const MIN_FAST_LEAD = 60;
const MIN_FAST_REMAINDER = 40;

export type { FastStart, Lead } from './playbackPlanningTypes';

// Build a deep buffer when synthesis comfortably beats realtime, but avoid
// spending scarce inference time far ahead when a slower device cannot keep up.
export function prefetchDepth(rtf: number | null): number {
  if (rtf == null) return PREFETCH_AHEAD;
  if (rtf >= 1.5) return 6;
  if (rtf >= 1.0) return PREFETCH_AHEAD;
  return 2;
}

// Resolve an exact text offset into the clip that should play first. Mid-chunk
// starts merge forward until they are long enough to avoid a tiny audio stutter.
export function buildLead(text: string, chunks: readonly Chunk[], charOffset: number): Lead | null {
  if (chunks.length === 0) return null;
  const i = findChunkIndexForOffset(chunks, charOffset);
  if (i < 0) return null;
  if (charOffset <= chunks[i].charStart) {
    return { chunk: chunks[i], anchorIdx: i, resumeIdx: i + 1 };
  }
  let j = i;
  while (chunks[j].charEnd - charOffset < MIN_LEAD && j + 1 < chunks.length) j++;
  const charEnd = chunks[j].charEnd;
  const leadText = text.slice(charOffset, charEnd);
  const chunk: Chunk = {
    idx: i,
    charStart: charOffset,
    charEnd,
    text: leadText,
    pages: [],
    textHash: stableHash(leadText),
  };
  return { chunk, anchorIdx: i, resumeIdx: j + 1 };
}

// Split an uncached start into a short first-sentence lead and the remainder of
// its canonical chunk. Small or single-sentence chunks stay intact.
export function buildFastStart(text: string, chunks: readonly Chunk[], charOffset: number): FastStart | null {
  if (chunks.length === 0) return null;
  const i = findChunkIndexForOffset(chunks, charOffset);
  if (i < 0) return null;
  const startAt = Math.max(charOffset, chunks[i].charStart);
  const chunkEnd = chunks[i].charEnd;
  if (chunkEnd - startAt < MIN_FAST_LEAD + MIN_FAST_REMAINDER) return null;
  const split = firstSentenceEnd(text, startAt, chunkEnd, MIN_FAST_LEAD);
  if (split >= chunkEnd || chunkEnd - split < MIN_FAST_REMAINDER) return null;
  const makeChunk = (from: number, to: number): Chunk => {
    const chunkText = text.slice(from, to);
    return {
      idx: i,
      charStart: from,
      charEnd: to,
      text: chunkText,
      pages: [],
      textHash: stableHash(chunkText),
    };
  };
  return {
    lead: { chunk: makeChunk(startAt, split), anchorIdx: i, resumeIdx: i + 1 },
    remainder: { chunk: makeChunk(split, chunkEnd), anchorIdx: i, resumeIdx: i + 1 },
  };
}

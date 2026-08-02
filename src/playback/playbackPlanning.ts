import { findChunkIndexForOffset, firstSentenceEnd } from '../supertonic';
import type { Chunk } from '../types';
import { stableHash } from '../utils';
import type { FastStart, Lead } from './playbackPlanningTypes';
import type { DevicePlaybackSnapshot, DevicePressure } from './devicePlaybackPolicyTypes';

const PREFETCH_AHEAD = 4;
const MIN_LEAD = 140;
const MIN_FAST_LEAD = 60;
const MIN_FAST_REMAINDER = 40;

export type { FastStart, Lead } from './playbackPlanningTypes';

// Build a deep buffer when synthesis comfortably beats realtime, but avoid
// spending scarce inference time far ahead when a slower device cannot keep up.
export function classifyDevicePressure(snapshot: DevicePlaybackSnapshot | null): DevicePressure {
  if (!snapshot) return 'normal';
  const thermal = snapshot.thermalStatus ?? 0;
  if (
    snapshot.lowMemory ||
    thermal >= 3 ||
    snapshot.availableMemoryBytes <= snapshot.memoryThresholdBytes * 1.25
  ) return 'critical';

  const memoryRatio = snapshot.totalMemoryBytes > 0
    ? snapshot.availableMemoryBytes / snapshot.totalMemoryBytes
    : 1;
  if (
    snapshot.powerSaveMode ||
    thermal >= 2 ||
    snapshot.cpuCores <= 4 ||
    snapshot.appMemoryClassMb <= 256 ||
    memoryRatio <= 0.15
  ) return 'constrained';
  return 'normal';
}

export function prefetchDepth(rtf: number | null, pressure: DevicePressure = 'normal'): number {
  const throughputDepth = rtf == null ? PREFETCH_AHEAD : rtf >= 1.5 ? 6 : rtf >= 1 ? PREFETCH_AHEAD : 2;
  if (pressure === 'critical') return 1;
  if (pressure === 'constrained') return Math.min(2, throughputDepth);
  return throughputDepth;
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

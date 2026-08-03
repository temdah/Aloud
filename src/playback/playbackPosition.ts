import type { Chunk } from '../types';
import type { DocumentPosition, DocumentPositionInput } from './playbackPositionTypes';

export function findChunkIndexAtTime(
  starts: readonly number[],
  currentTime: number,
  chunkCount: number,
): number {
  let low = 0;
  let high = Math.min(starts.length, chunkCount) - 1;
  let index = 0;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (starts[middle] <= currentTime) {
      index = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return index;
}

export function charOffsetForTime(chunk: Chunk, neutralDuration: number, withinNeutralSec: number): number {
  const span = chunk.charEnd - chunk.charStart;
  const fraction = neutralDuration > 0
    ? Math.min(1, Math.max(0, withinNeutralSec / neutralDuration))
    : 0;
  return chunk.charStart + Math.floor(fraction * span);
}

export function calculateDocumentPosition(input: DocumentPositionInput): DocumentPosition {
  const {
    singleItem,
    isLoaded,
    currentTime,
    mediaDuration,
    speed,
    tableDuration,
    offsets,
    durations,
    anchorIndex,
    chunks,
    currentChunk,
  } = input;
  if (singleItem && isLoaded) {
    return {
      positionSec: currentTime / speed,
      durationSec: mediaDuration > 0 ? mediaDuration / speed : tableDuration,
    };
  }
  if (!offsets || !durations || anchorIndex < 0 || anchorIndex >= offsets.length) {
    return { positionSec: 0, durationSec: tableDuration };
  }

  const canonical = chunks[anchorIndex];
  let leadNeutral = 0;
  if (canonical && currentChunk && canonical.charEnd > canonical.charStart) {
    const leadChars = Math.max(0, currentChunk.charStart - canonical.charStart);
    leadNeutral = durations[anchorIndex] * Math.min(1, leadChars / (canonical.charEnd - canonical.charStart));
  }
  return {
    positionSec: offsets[anchorIndex] + (leadNeutral + (isLoaded ? currentTime : 0)) / speed,
    durationSec: tableDuration,
  };
}

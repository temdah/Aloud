import { findChunkIndexForOffset } from '../supertonic/narration/chunkLookup';
import type { Chunk } from '../types';

// Builds neutral-rate starts plus a final end marker. Real stitched-file starts
// take precedence because they avoid cumulative prediction drift.
export function buildNeutralStarts(durations: readonly number[], fileStarts: readonly number[] | null): number[] {
  if (fileStarts && fileStarts.length === durations.length && fileStarts.length > 0) {
    const starts = fileStarts.slice();
    starts.push(fileStarts[fileStarts.length - 1] + (durations[durations.length - 1] ?? 0));
    return starts;
  }

  const starts = new Array<number>(durations.length + 1);
  starts[0] = 0;
  for (let i = 0; i < durations.length; i++) starts[i + 1] = starts[i] + durations[i];
  return starts;
}

export function neutralTimeForOffset(
  chunks: readonly Chunk[],
  neutralStarts: readonly number[],
  charOffset: number,
): number {
  const index = findChunkIndexForOffset(chunks, charOffset);
  if (index < 0 || index + 1 >= neutralStarts.length) return 0;
  const chunk = chunks[index];
  const span = chunk.charEnd - chunk.charStart;
  const fraction = span > 0 ? Math.min(1, Math.max(0, (charOffset - chunk.charStart) / span)) : 0;
  return neutralStarts[index] + fraction * (neutralStarts[index + 1] - neutralStarts[index]);
}

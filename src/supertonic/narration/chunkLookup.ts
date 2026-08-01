import type { Chunk } from '../../types';

// Chunks are stored in source order and never overlap. Find the chunk containing
// charOffset, or the next chunk when the offset lands in trimmed whitespace.
// Returning -1 beyond the document matches Array.findIndex's former behavior.
export function findChunkIndexForOffset(chunks: readonly Chunk[], charOffset: number): number {
  let lo = 0;
  let hi = chunks.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (chunks[mid].charEnd <= charOffset) lo = mid + 1;
    else hi = mid;
  }
  return lo < chunks.length ? lo : -1;
}

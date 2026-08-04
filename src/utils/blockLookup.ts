import type { IndexedOffsetRange, OffsetRange } from './blockLookupTypes';

export function findBlockForOffset<T extends OffsetRange>(
  blocks: readonly IndexedOffsetRange<T>[],
  offset: number,
): IndexedOffsetRange<T> | null {
  let low = 0;
  let high = blocks.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (blocks[middle].block.charEnd <= offset) low = middle + 1;
    else high = middle;
  }
  const match = blocks[low];
  return match && offset >= match.block.charStart ? match : null;
}

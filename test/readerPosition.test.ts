import assert from 'node:assert/strict';
import { test } from '@jest/globals';
import { findBlockForOffset, rangesOverlap, type IndexedOffsetRange } from '../src/utils';

const blocks: IndexedOffsetRange[] = [
  { block: { charStart: 0, charEnd: 5 }, globalIndex: 0 },
  { block: { charStart: 7, charEnd: 30 }, globalIndex: 1 },
  { block: { charStart: 32, charEnd: 60 }, globalIndex: 4 },
];

test('rangesOverlap keeps partial resumed sentences highlighted', () => {
  assert.equal(rangesOverlap(10, 20, 15, 25), true);
  assert.equal(rangesOverlap(10, 20, 20, 25), false);
  assert.equal(rangesOverlap(10, 20, 5, 10), false);
});

test('findReadableBlockForOffset locates headings and paragraphs by canonical offset', () => {
  assert.equal(findBlockForOffset(blocks, 0)?.globalIndex, 0);
  assert.equal(findBlockForOffset(blocks, 18)?.globalIndex, 1);
  assert.equal(findBlockForOffset(blocks, 45)?.globalIndex, 4);
  assert.equal(findBlockForOffset(blocks, 6), null);
  assert.equal(findBlockForOffset(blocks, 60), null);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { findChunkIndexForOffset } from '../src/supertonic/narration/chunkLookup';
import type { Chunk } from '../src/types/document';

const chunks: Chunk[] = [
  { idx: 0, text: 'abcd', charStart: 2, charEnd: 6, pages: [], textHash: 'a' },
  { idx: 1, text: 'efgh', charStart: 8, charEnd: 12, pages: [], textHash: 'b' },
];

test('findChunkIndexForOffset finds contents and advances across trimmed whitespace', () => {
  assert.equal(findChunkIndexForOffset(chunks, 2), 0);
  assert.equal(findChunkIndexForOffset(chunks, 5), 0);
  assert.equal(findChunkIndexForOffset(chunks, 6), 1);
  assert.equal(findChunkIndexForOffset(chunks, 7), 1);
  assert.equal(findChunkIndexForOffset(chunks, 8), 1);
  assert.equal(findChunkIndexForOffset(chunks, 12), -1);
});

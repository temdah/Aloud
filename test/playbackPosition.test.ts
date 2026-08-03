import assert from 'node:assert/strict';
import { test } from '@jest/globals';
import { calculateDocumentPosition, charOffsetForTime, findChunkIndexAtTime } from '../src/playback';
import type { Chunk } from '../src/types';

const chunks: Chunk[] = [
  { idx: 0, charStart: 0, charEnd: 100, text: 'A', pages: [1], textHash: 'a' },
  { idx: 1, charStart: 100, charEnd: 200, text: 'B', pages: [1], textHash: 'b' },
];

test('findChunkIndexAtTime uses the latest start at or before playback time', () => {
  assert.equal(findChunkIndexAtTime([0, 5, 12], 0, 3), 0);
  assert.equal(findChunkIndexAtTime([0, 5, 12], 8, 3), 1);
  assert.equal(findChunkIndexAtTime([0, 5, 12], 99, 3), 2);
});

test('charOffsetForTime clamps time within a canonical chunk', () => {
  assert.equal(charOffsetForTime(chunks[1], 10, 5), 150);
  assert.equal(charOffsetForTime(chunks[1], 10, 20), 200);
  assert.equal(charOffsetForTime(chunks[1], 0, 5), 100);
});

test('calculateDocumentPosition maps both audiobook and partial clips', () => {
  assert.deepEqual(calculateDocumentPosition({
    singleItem: true,
    isLoaded: true,
    currentTime: 20,
    mediaDuration: 100,
    speed: 2,
    tableDuration: 60,
    offsets: [0, 10],
    durations: [10, 10],
    anchorIndex: 0,
    chunks,
    currentChunk: chunks[0],
  }), { positionSec: 10, durationSec: 50 });

  assert.deepEqual(calculateDocumentPosition({
    singleItem: false,
    isLoaded: true,
    currentTime: 2,
    mediaDuration: 5,
    speed: 1,
    tableDuration: 20,
    offsets: [0, 10],
    durations: [10, 10],
    anchorIndex: 1,
    chunks,
    currentChunk: { ...chunks[1], charStart: 150 },
  }), { positionSec: 17, durationSec: 20 });
});

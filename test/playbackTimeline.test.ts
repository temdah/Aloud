import assert from 'node:assert/strict';
import test from 'node:test';
import { buildNeutralStarts, neutralTimeForOffset } from '../src/playback';
import type { Chunk } from '../src/types';

const chunks: Chunk[] = [
  { idx: 0, charStart: 0, charEnd: 10, text: '0123456789', pages: [], textHash: 'a' },
  { idx: 1, charStart: 10, charEnd: 30, text: '01234567890123456789', pages: [], textHash: 'b' },
];

test('buildNeutralStarts accumulates predicted chunk durations', () => {
  assert.deepEqual(buildNeutralStarts([2, 3.5], null), [0, 2, 5.5]);
});

test('buildNeutralStarts prefers stitched-file offsets and appends the final end', () => {
  assert.deepEqual(buildNeutralStarts([2, 3.5], [0, 2.2]), [0, 2.2, 5.7]);
});

test('neutralTimeForOffset interpolates within the canonical chunk', () => {
  assert.equal(neutralTimeForOffset(chunks, [0, 2, 6], 5), 1);
  assert.equal(neutralTimeForOffset(chunks, [0, 2, 6], 20), 4);
  assert.equal(neutralTimeForOffset(chunks, [0, 2, 6], 29), 5.8);
});

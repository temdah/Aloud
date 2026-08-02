import assert from 'node:assert/strict';
import test from 'node:test';
import { createNarrationPlan } from '../src/supertonic';
import type { Chunk } from '../src/types';

test('createNarrationPlan keeps canonical text, chunks, and sentence offsets together', () => {
  const text = 'First sentence. Second sentence!';
  const chunks: Chunk[] = [
    { idx: 0, charStart: 0, charEnd: text.length, text, pages: [], textHash: 'chunk' },
  ];

  const plan = createNarrationPlan(text, chunks);

  assert.equal(plan.text, text);
  assert.equal(plan.chunks, chunks);
  assert.deepEqual(plan.sentences, [
    { charStart: 0, charEnd: 15 },
    { charStart: 16, charEnd: 32 },
  ]);
});

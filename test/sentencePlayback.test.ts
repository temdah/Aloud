import assert from 'node:assert/strict';
import { test } from '@jest/globals';
import { buildChunks, createNarrationPlan } from '../src/supertonic';
import { buildDocument } from '../src/extractors';
import {
  findSentenceIndexForOffset,
  sentenceTargetAtIndex,
  sentenceTargetForStart,
} from '../src/playback';

const text = 'First sentence.  Second sentence! Third sentence?';
const plan = createNarrationPlan(text, buildChunks(text, 35));

test('findSentenceIndexForOffset finds containing or next sentence in logarithmic lookup', () => {
  assert.equal(findSentenceIndexForOffset(plan.sentences, 2), 0);
  assert.equal(findSentenceIndexForOffset(plan.sentences, 15), 1);
  assert.equal(findSentenceIndexForOffset(plan.sentences, text.length), -1);
});

test('sentenceTargetForStart accepts stable boundaries but rejects mid-sentence starts', () => {
  assert.equal(sentenceTargetForStart(plan, 15)?.sentenceIndex, 1);
  assert.equal(sentenceTargetForStart(plan, 16)?.sentenceIndex, 1);
  assert.equal(sentenceTargetForStart(plan, 20), null);
});

test('sentenceTargetAtIndex maps an anchor back to its enclosing canonical chunk', () => {
  const target = sentenceTargetAtIndex(plan, 1);

  assert.ok(target);
  assert.equal(target.chunk.text, 'Second sentence!');
  assert.equal(target.chunk.charStart, 17);
  assert.equal(target.canonicalIndex, 0);
  assert.equal(target.nextCanonicalIndex, 1);
});

test('reader sentence taps and narration anchors share canonical starts', () => {
  const document = buildDocument([
    { kind: 'p', text: 'Smith et al. reported a result. The follow-up confirmed it.' },
  ]);
  const narration = createNarrationPlan(document.text, buildChunks(document.text, 120));
  const readerStarts = document.blocks.flatMap((block) =>
    block.kind === 'p' ? block.sentences.map((sentence) => sentence.charStart) : [],
  );

  assert.deepEqual(narration.sentences.map((sentence) => sentence.charStart), readerStarts);
});

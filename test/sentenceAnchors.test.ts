import assert from 'node:assert/strict';
import test from 'node:test';
import { createNarrationPlan } from '../src/supertonic/narration/narrationPlan';
import { buildSentenceAnchors, MAX_SENTENCE_ANCHOR_CHARS } from '../src/supertonic/narration/sentenceAnchors';
import { buildChunks } from '../src/supertonic/narration/textChunker';

test('sentence identities remain stable when canonical chunk size changes', () => {
  const text = 'A short opening. A longer second sentence provides enough text to cross a small chunk boundary. Final line.';
  const fastPlan = createNarrationPlan(text, buildChunks(text, 30));
  const qualityPlan = createNarrationPlan(text, buildChunks(text, 100));

  assert.deepEqual(fastPlan.sentences, qualityPlan.sentences);
  assert.notDeepEqual(fastPlan.chunks, qualityPlan.chunks);
});

test('oversized sentences receive deterministic bounded anchors', () => {
  const text = `${'long phrase '.repeat(100)}ends here.`;
  const first = buildSentenceAnchors(text);
  const second = buildSentenceAnchors(text);

  assert.deepEqual(first, second);
  assert.ok(first.length > 1);
  assert.ok(first.every((anchor) => anchor.charEnd - anchor.charStart <= MAX_SENTENCE_ANCHOR_CHARS));
  assert.ok(first.every((anchor, index) => anchor.ordinal === index));
  assert.ok(first.every((anchor) => text.slice(anchor.charStart, anchor.charEnd).length > 0));
});

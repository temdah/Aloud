import assert from 'node:assert/strict';
import test from 'node:test';
import { firstSentenceEnd, sentenceBoundaries, sentenceSpans } from '../src/supertonic/text/segmentation';

test('sentenceBoundaries shares abbreviation, paragraph, and CJK rules', () => {
  const text = 'Smith et al. 2019 agreed. Heading\n\n下一句。 Final sentence!';

  assert.deepEqual(sentenceBoundaries(text), [
    text.indexOf('agreed.') + 'agreed.'.length,
    text.indexOf('\n\n'),
    text.indexOf('。') + 1,
    text.length,
  ]);
});

test('sentenceSpans preserves canonical offsets and trims separators', () => {
  const text = '  First sentence.\n\n  Second sentence!  ';

  assert.deepEqual(sentenceSpans(text), [
    { charStart: 2, charEnd: 17 },
    { charStart: 21, charEnd: 37 },
  ]);
});

test('firstSentenceEnd skips short and abbreviated endings', () => {
  const text = `Dr. ${'A'.repeat(60)} finished here. ${'B'.repeat(50)}`;

  assert.equal(firstSentenceEnd(text, 0, text.length, 60), text.indexOf(' finished here.') + ' finished here.'.length);
});

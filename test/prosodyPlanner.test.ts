import assert from 'node:assert/strict';
import { test } from '@jest/globals';
import { planProsody, silenceSampleCount } from '../src/supertonic';

test('planProsody gives questions and ellipses expressive sentence pauses', () => {
  const question = 'Are you still there? Next sentence.';
  const ellipsis = 'The footsteps stopped... Then the door moved.';

  assert.deepEqual(planProsody(question, 0, 20), {
    synthesisText: 'Are you still there?',
    trailingPauseMs: 250,
    boundary: 'question',
  });
  assert.deepEqual(planProsody(ellipsis, 0, 24), {
    synthesisText: 'The footsteps stopped...',
    trailingPauseMs: 300,
    boundary: 'ellipsis',
  });
});

test('planProsody uses a longer pause between paragraphs and cues unpunctuated headings', () => {
  const text = 'The First Chapter\n\nIt began at midnight.';
  assert.deepEqual(planProsody(text, 0, 17), {
    synthesisText: 'The First Chapter.',
    trailingPauseMs: 350,
    boundary: 'paragraph',
  });

  const quoted = '“A Warning”\n\nDo not enter.';
  assert.equal(planProsody(quoted, 0, 11).synthesisText, '“A Warning.”');
});

test('planProsody gives oversized sentence continuations a non-final cadence', () => {
  const text = 'This sentence needs to continue across another stable unit.';
  assert.deepEqual(planProsody(text, 0, 22), {
    synthesisText: 'This sentence needs to,',
    trailingPauseMs: 65,
    boundary: 'continuation',
  });
});

test('silenceSampleCount converts pause duration without allocating a waveform', () => {
  assert.equal(silenceSampleCount(44_100, 300), 13_230);
  assert.equal(silenceSampleCount(44_100, 0), 0);
});

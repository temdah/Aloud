import assert from 'node:assert/strict';
import test from 'node:test';
import { sentenceCacheBaseName, sentenceSettingsHash, settingsHash } from '../src/supertonic';
import type { NarrationSettings } from '../src/supertonic';

const settings: NarrationSettings = {
  modelId: 'supertonic-3',
  voiceId: 'M1',
  speed: 1,
  steps: 5,
  lang: 'en',
  quality: 'fast',
};

test('sentence cache identity combines stable anchor and synthesis settings', () => {
  const anchor = { id: 's1-10-25-abc' };

  assert.equal(sentenceCacheBaseName(anchor, settings), `sentence-${anchor.id}-${sentenceSettingsHash(settings)}`);
});

test('playback speed does not invalidate sentence audio identity', () => {
  const anchor = { id: 's1-10-25-abc' };

  assert.equal(sentenceCacheBaseName(anchor, settings), sentenceCacheBaseName(anchor, { ...settings, speed: 1.5 }));
});

test('chunk quality does not invalidate identical sentence synthesis', () => {
  const anchor = { id: 's1-10-25-abc' };

  assert.notEqual(settingsHash(settings), settingsHash({ ...settings, quality: 'quality' }));
  assert.equal(sentenceCacheBaseName(anchor, settings), sentenceCacheBaseName(anchor, { ...settings, quality: 'quality' }));
});

test('voice and synthesis steps produce different sentence audio identities', () => {
  const anchor = { id: 's1-10-25-abc' };

  assert.notEqual(sentenceCacheBaseName(anchor, settings), sentenceCacheBaseName(anchor, { ...settings, voiceId: 'F1' }));
  assert.notEqual(sentenceCacheBaseName(anchor, settings), sentenceCacheBaseName(anchor, { ...settings, steps: 8 }));
});

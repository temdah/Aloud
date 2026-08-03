import assert from 'node:assert/strict';
import { test } from '@jest/globals';
import { PlaybackPreparation, type PlaybackPreparationDependencies } from '../src/playback';
import type { NarrationSettings } from '../src/supertonic';
import type { Chunk } from '../src/types';

const settings: NarrationSettings = {
  modelId: 'model', voiceId: 'voice', speed: 1, steps: 8, lang: 'en', quality: 'quality', tone: 'neutral',
};
const chunk: Chunk = { idx: 0, charStart: 0, charEnd: 5, text: 'Text.', pages: [1], textHash: 'hash' };

function dependencies(cached: boolean): PlaybackPreparationDependencies {
  return {
    isChunkCached: () => cached,
    isLeadCached: () => cached,
    isSentenceCached: () => cached,
    chunkAudioUri: () => 'chunk-cache.m4a',
    leadAudioFile: () => ({ uri: 'lead-cache.m4a' }) as never,
    sentenceAudioUri: () => 'sentence-cache.m4a',
  };
}

test('PlaybackPreparation returns canonical cache hits without synthesis', async () => {
  const decisions: string[] = [];
  const synthesizer = {
    prepareChunk: async () => { throw new Error('unexpected synthesis'); },
    prepareSentence: async () => { throw new Error('unexpected synthesis'); },
  };
  const preparation = new PlaybackPreparation({ docHash: 'doc', settings, synthesizer }, dependencies(true));

  const result = await preparation.prepareChunk(chunk, 'canonical', {
    shouldContinue: () => true,
    onDecision: (decision) => { decisions.push(decision); },
  });

  assert.equal(result?.uri, 'chunk-cache.m4a');
  assert.deepEqual(decisions, ['canonical-cache']);
});

test('PlaybackPreparation reports synthesis and returns generated audio', async () => {
  const decisions: string[] = [];
  const synthesizer = {
    prepareChunk: async () => 'generated.m4a',
    prepareSentence: async () => 'sentence.m4a',
  };
  const preparation = new PlaybackPreparation({ docHash: 'doc', settings, synthesizer }, dependencies(false));

  const result = await preparation.prepareChunk(chunk, 'lead', {
    shouldContinue: () => true,
    onDecision: (decision, cached) => { decisions.push(`${decision}:${cached}`); },
  });

  assert.equal(result?.uri, 'generated.m4a');
  assert.deepEqual(decisions, ['lead-synthesis:false']);
});

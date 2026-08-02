import assert from 'node:assert/strict';
import { test } from '@jest/globals';
import { PlaybackSynthesizer, type PlaybackSynthesizerDependencies } from '../src/playback';
import type { NarrationSettings } from '../src/supertonic';
import type { Chunk, SentenceAnchor } from '../src/types';

const settings: NarrationSettings = {
  modelId: 'model-a',
  voiceId: 'voice-a',
  speed: 1,
  steps: 8,
  lang: 'en',
  quality: 'quality',
  tone: 'neutral',
};

const chunk: Chunk = {
  idx: 0,
  text: 'A sentence.',
  charStart: 10,
  charEnd: 21,
  pages: [1],
  textHash: 'chunk-hash',
};
const anchor: SentenceAnchor = {
  id: '10:21',
  ordinal: 0,
  charStart: 10,
  charEnd: 21,
  textHash: 'sentence-hash',
};

function dependencies(calls: string[]): PlaybackSynthesizerDependencies {
  return {
    getVoice: async () => {
      calls.push('voice');
      return { dp: {}, ttl: {} } as never;
    },
    withEngine: async (_, run, priority) => {
      calls.push(`engine:${priority}`);
      return run({} as never);
    },
    ensureChunkAudio: async () => {
      calls.push('canonical');
      return 'chunk.m4a';
    },
    ensureLeadAudio: async () => {
      calls.push('lead');
      return 'lead.m4a';
    },
    ensureSentenceAudio: async () => {
      calls.push('sentence');
      return 'sentence.m4a';
    },
  };
}

test('PlaybackSynthesizer routes each clip through the engine boundary', async () => {
  const calls: string[] = [];
  const deps = dependencies(calls);
  const synthesizer = new PlaybackSynthesizer(
    { docHash: 'doc', documentText: chunk.text, settings },
    deps,
  );

  assert.equal(await synthesizer.prepareChunk(chunk, 'canonical'), 'chunk.m4a');
  assert.equal(await synthesizer.prepareChunk(chunk, 'lead', { priority: 'background' }), 'lead.m4a');
  assert.equal(await synthesizer.prepareSentence(anchor), 'sentence.m4a');
  assert.deepEqual(calls, [
    'voice',
    'engine:foreground',
    'canonical',
    'engine:background',
    'lead',
    'engine:foreground',
    'sentence',
  ]);
});

test('PlaybackSynthesizer cancels before queued synthesis starts', async () => {
  const calls: string[] = [];
  const deps = dependencies(calls);
  let current = true;
  deps.withEngine = async (_, run, priority) => {
    calls.push(`engine:${priority}`);
    current = false;
    return run({} as never);
  };
  const synthesizer = new PlaybackSynthesizer(
    { docHash: 'doc', documentText: chunk.text, settings },
    deps,
  );

  const cancelled = await synthesizer.prepareSentence(anchor, { shouldContinue: () => current });

  assert.equal(cancelled, null);
  assert.deepEqual(calls, ['voice', 'engine:foreground']);
});

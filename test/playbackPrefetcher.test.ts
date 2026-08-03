import assert from 'node:assert/strict';
import { test } from '@jest/globals';
import { PlaybackPrefetcher, type PlaybackPrefetcherDependencies } from '../src/playback';
import { buildChunks, createNarrationPlan, type NarrationSettings } from '../src/supertonic';
import type { Chunk } from '../src/types';

const settings: NarrationSettings = {
  modelId: 'model-a',
  voiceId: 'voice-a',
  speed: 1,
  steps: 8,
  lang: 'en',
  quality: 'quality',
  tone: 'neutral',
};

function chunk(idx: number): Chunk {
  return {
    idx,
    charStart: idx * 10,
    charEnd: idx * 10 + 9,
    text: `Chunk ${idx}.`,
    pages: [1],
    textHash: `hash-${idx}`,
  };
}

function dependencies(cachedStarts: number[] = []): PlaybackPrefetcherDependencies {
  return {
    getDevicePerformanceSnapshot: () => null,
    getSynthRtf: () => 2,
    isChunkCached: (_, charStart) => cachedStarts.includes(charStart),
    isSentenceCached: () => false,
    classifyDevicePressure: () => 'normal',
    prefetchDepth: () => 2,
    recordPrefetchDepth: () => {},
  };
}

test('PlaybackPrefetcher orders immediate, buffered, and enclosing chunks', async () => {
  const prepared: number[] = [];
  const chunks = [chunk(0), chunk(1), chunk(2), chunk(3)];
  const synthesizer = {
    prepareChunk: async (item: Chunk) => {
      prepared.push(item.charStart);
      return 'audio.m4a';
    },
    prepareSentence: async () => 'audio.m4a',
  };
  const prefetcher = new PlaybackPrefetcher(
    { docHash: 'doc', settings, synthesizer },
    dependencies([chunks[2].charStart]),
  );

  await prefetcher.prefetchCanonical({
    chunks,
    startIndex: 1,
    immediate: chunk(9),
    enclosing: chunks[0],
    shouldContinue: () => true,
  });

  assert.deepEqual(prepared, [90, 10, 0]);
});

test('PlaybackPrefetcher stops sentence work when the request is cancelled', async () => {
  const prepared: number[] = [];
  let current = true;
  const text = 'One sentence. Two sentence. Three sentence.';
  const plan = createNarrationPlan(text, buildChunks(text, 400));
  const synthesizer = {
    prepareChunk: async () => 'audio.m4a',
    prepareSentence: async (anchor: { ordinal: number }) => {
      prepared.push(anchor.ordinal);
      current = false;
      return 'audio.m4a';
    },
  };
  const prefetcher = new PlaybackPrefetcher(
    { docHash: 'doc', settings, synthesizer },
    dependencies(),
  );

  await prefetcher.prefetchSentences({ plan, startIndex: 1, shouldContinue: () => current });

  assert.deepEqual(prepared, [1]);
});

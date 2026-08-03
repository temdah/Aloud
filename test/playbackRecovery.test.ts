import assert from 'node:assert/strict';
import { test } from '@jest/globals';
import { PlaybackRecoveryController, type PlaybackRecoveryDependencies } from '../src/playback';
import { buildChunks, createNarrationPlan, type NarrationSettings } from '../src/supertonic';

const settings: NarrationSettings = {
  modelId: 'model', voiceId: 'voice', speed: 1, steps: 8, lang: 'en', quality: 'quality', tone: 'neutral',
};

function dependencies(deleted: string[]): PlaybackRecoveryDependencies {
  return {
    deleteSentenceCache: () => { deleted.push('sentence'); },
    deleteChunkCache: () => { deleted.push('chunk'); },
    deleteLeadCache: () => { deleted.push('lead'); },
    deleteAudiobookCache: () => { deleted.push('audiobook'); },
  };
}

test('PlaybackRecoveryController invalidates a clip only once automatically', () => {
  const deleted: string[] = [];
  const text = 'First sentence. Second sentence.';
  const chunks = buildChunks(text, 100);
  const context = {
    docHash: 'doc',
    plan: createNarrationPlan(text, chunks),
    chunks,
    settings,
    currentChunkIndex: 0,
  };
  const controller = new PlaybackRecoveryController(dependencies(deleted));
  const clip = { kind: 'sentence' as const, key: 'sentence:0', sentenceIndex: 0 };

  assert.deepEqual(controller.recover(clip, context), { kind: 'sentence', sentenceIndex: 0 });
  assert.equal(controller.recover(clip, context).kind, 'exhausted');
  assert.deepEqual(deleted, ['sentence']);
});

test('PlaybackRecoveryController allows explicit retry and audiobook fallback', () => {
  const deleted: string[] = [];
  const text = 'First sentence.';
  const chunks = buildChunks(text, 100);
  const context = {
    docHash: 'doc',
    plan: createNarrationPlan(text, chunks),
    chunks,
    settings,
    currentChunkIndex: 8,
  };
  const controller = new PlaybackRecoveryController(dependencies(deleted));
  const clip = { kind: 'audiobook' as const, key: 'book' };

  assert.deepEqual(controller.recover(clip, context), { kind: 'audiobook', fallbackIndex: 0 });
  assert.deepEqual(controller.recover(clip, context, true), { kind: 'audiobook', fallbackIndex: 0 });
  assert.deepEqual(deleted, ['audiobook', 'audiobook']);
});

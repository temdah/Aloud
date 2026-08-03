import assert from 'node:assert/strict';
import { test } from '@jest/globals';
import { resolveWarmEngineModel, shouldReleaseEngineOnBackground } from '../src/playback';

test('resolveWarmEngineModel prefers the active document model', () => {
  assert.equal(resolveWarmEngineModel('new-default', 'document-model'), 'document-model');
  assert.equal(resolveWarmEngineModel('new-default', null), 'new-default');
});

test('low-memory policy releases only when playback is inactive', () => {
  assert.equal(shouldReleaseEngineOnBackground(false, false, false), true);
  assert.equal(shouldReleaseEngineOnBackground(false, true, false), false);
  assert.equal(shouldReleaseEngineOnBackground(false, false, true), false);
  assert.equal(shouldReleaseEngineOnBackground(true, false, false), false);
});

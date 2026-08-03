import assert from 'node:assert/strict';
import { test } from '@jest/globals';
import { buildPlaybackLockMetadata, mirroredPlaybackRate } from '../src/playback';

test('buildPlaybackLockMetadata normalizes notification labels', () => {
  assert.deepEqual(buildPlaybackLockMetadata('  Chapter One  ', '  Author  ', 'art.png'), {
    title: 'Chapter One',
    artist: 'Author',
    albumTitle: 'Aloud',
    artworkUrl: 'art.png',
  });
  assert.deepEqual(buildPlaybackLockMetadata(' ', undefined), {
    title: 'Document',
    artist: 'Aloud',
    albumTitle: 'Aloud',
  });
});

test('mirroredPlaybackRate accepts only external changes from active playback', () => {
  assert.equal(mirroredPlaybackRate(1, 1.5, false, true, 0, 2000), null);
  assert.equal(mirroredPlaybackRate(1, 1.5, true, false, 0, 2000), null);
  assert.equal(mirroredPlaybackRate(1, 1.5, true, true, 1500, 2000), null);
  assert.equal(mirroredPlaybackRate(1, 1.01, true, true, 0, 2000), null);
  assert.equal(mirroredPlaybackRate(1, 0, true, true, 0, 2000), null);
  assert.equal(mirroredPlaybackRate(1, 1.256, true, true, 0, 2000), 1.26);
});

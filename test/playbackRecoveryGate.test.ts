import assert from 'node:assert/strict';
import test from 'node:test';
import { PlaybackRecoveryGate } from '../src/playback/playbackRecoveryGate';

test('PlaybackRecoveryGate permits only one automatic rebuild per clip', () => {
  const gate = new PlaybackRecoveryGate();

  assert.equal(gate.claim('sentence:1'), true);
  assert.equal(gate.claim('sentence:1'), false);
  assert.equal(gate.claim('sentence:2'), true);
});

test('PlaybackRecoveryGate allows explicit retry and session reset', () => {
  const gate = new PlaybackRecoveryGate();
  gate.claim('chunk:1');
  gate.reset('chunk:1');
  assert.equal(gate.claim('chunk:1'), true);

  gate.clear();
  assert.equal(gate.claim('chunk:1'), true);
});

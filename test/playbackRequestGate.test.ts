import assert from 'node:assert/strict';
import test from 'node:test';
import { PlaybackRequestGate } from '../src/playback';

test('PlaybackRequestGate gives ownership only to the newest request', () => {
  const gate = new PlaybackRequestGate();
  const first = gate.begin();
  const second = gate.begin();

  assert.equal(gate.isCurrent(first), false);
  assert.equal(gate.isCurrent(second), true);
});

test('PlaybackRequestGate invalidates in-flight work when cancelled', () => {
  const gate = new PlaybackRequestGate();
  const request = gate.begin();

  gate.cancel();

  assert.equal(gate.isCurrent(request), false);
  assert.equal(gate.current(), request + 1);
});

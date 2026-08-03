import assert from 'node:assert/strict';
import { test } from '@jest/globals';
import { normalizeSynthesisSteps } from '../src/supertonic';

test('synthesis step normalization enforces the five-step quality floor', () => {
  assert.equal(normalizeSynthesisSteps(4), 5);
  assert.equal(normalizeSynthesisSteps(5), 5);
  assert.equal(normalizeSynthesisSteps(7.6), 8);
  assert.equal(normalizeSynthesisSteps(Number.NaN), 5);
});

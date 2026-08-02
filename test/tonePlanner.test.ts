import assert from 'node:assert/strict';
import test from 'node:test';
import { isAcademicDocument, normalizeNarrationTone, planNarrationTone } from '../src/supertonic';

test('adaptive tone keeps academic documents neutral', () => {
  const paper = 'Abstract. This study presents a methodology and analysis of experimental data. Results and discussion follow.';
  assert.equal(isAcademicDocument(paper), true);
  assert.equal(planNarrationTone(paper, 'The result was wonderful!', 'adaptive').resolved, 'neutral');
});

test('adaptive tone responds to story language', () => {
  assert.equal(planNarrationTone('', 'She smiled, delighted by the wonderful sunshine.', 'adaptive', false).resolved, 'happy');
  assert.equal(planNarrationTone('', 'Footsteps moved through the darkness and he trembled in fear.', 'adaptive', false).resolved, 'scared');
  assert.equal(planNarrationTone('', 'Alone, she wept with grief and sorrow.', 'adaptive', false).resolved, 'sad');
});

test('static tone overrides document classification', () => {
  const plan = planNarrationTone('Abstract results methodology analysis data.', 'A neutral sentence.', 'happy');
  assert.equal(plan.resolved, 'happy');
  assert.ok(plan.synthesisSpeed > 1);
  assert.ok(plan.pauseScale < 1);
});

test('unknown persisted tone falls back to adaptive', () => {
  assert.equal(normalizeNarrationTone('dramatic'), 'adaptive');
});

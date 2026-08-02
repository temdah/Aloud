import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFastStart, buildLead, prefetchDepth } from '../src/playback/playbackPlanning';
import type { Chunk } from '../src/types/document';

function chunk(idx: number, text: string, charStart: number): Chunk {
  return {
    idx,
    text,
    charStart,
    charEnd: charStart + text.length,
    pages: [],
    textHash: `hash-${idx}`,
  };
}

test('buildLead returns the canonical chunk at its exact start', () => {
  const chunks = [chunk(0, 'A'.repeat(180), 0), chunk(1, 'B'.repeat(180), 180)];
  const result = buildLead('A'.repeat(180) + 'B'.repeat(180), chunks, 0);

  assert.equal(result?.chunk, chunks[0]);
  assert.equal(result?.anchorIdx, 0);
  assert.equal(result?.resumeIdx, 1);
});

test('buildLead joins forward when a tapped remainder is too short', () => {
  const text = 'A'.repeat(180) + 'B'.repeat(180);
  const chunks = [chunk(0, text.slice(0, 180), 0), chunk(1, text.slice(180), 180)];
  const result = buildLead(text, chunks, 100);

  assert.equal(result?.chunk.charStart, 100);
  assert.equal(result?.chunk.charEnd, 360);
  assert.equal(result?.chunk.text, text.slice(100));
  assert.equal(result?.resumeIdx, 2);
});

test('buildFastStart keeps abbreviations inside the first spoken sentence', () => {
  const first = `${'A'.repeat(60)} et al. 2019 found the result. `;
  const second = 'The next sentence contains enough material to remain useful.';
  const text = first + second;
  const chunks = [chunk(0, text, 0)];
  const result = buildFastStart(text, chunks, 0);

  assert.equal(result?.lead.chunk.text, first.trimEnd());
  assert.equal(result?.remainder?.chunk.text, text.slice(first.trimEnd().length));
});

test('buildFastStart recognizes CJK punctuation', () => {
  const first = `${'甲'.repeat(60)}。`;
  const second = '乙'.repeat(50);
  const text = first + second;
  const result = buildFastStart(text, [chunk(0, text, 0)], 0);

  assert.equal(result?.lead.chunk.text, first);
  assert.equal(result?.remainder?.chunk.text, second);
});

test('prefetchDepth preserves the current throughput thresholds', () => {
  assert.equal(prefetchDepth(null), 4);
  assert.equal(prefetchDepth(0.99), 2);
  assert.equal(prefetchDepth(1), 4);
  assert.equal(prefetchDepth(1.49), 4);
  assert.equal(prefetchDepth(1.5), 6);
});

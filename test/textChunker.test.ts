import assert from 'node:assert/strict';
import test from 'node:test';
import { chunkText } from '../src/supertonic/narration/textChunker';

test('chunkText preserves exact source offsets around trimmed whitespace', () => {
  const text = '  First sentence.\n\n  Second sentence!  ';
  const chunks = chunkText(text, 100);

  assert.deepEqual(chunks, [
    { text: 'First sentence.\n\n  Second sentence!', charStart: 2, charEnd: 37 },
  ]);
  for (const chunk of chunks) assert.equal(chunk.text, text.slice(chunk.charStart, chunk.charEnd));
});

test('chunkText does not split common academic abbreviations', () => {
  const text = 'Smith et al. 2019 found a result. The next sentence confirms it.';
  const chunks = chunkText(text, 38);

  assert.deepEqual(chunks.map((chunk) => chunk.text), [
    'Smith et al. 2019 found a result.',
    'The next sentence confirms it.',
  ]);
});

test('chunkText recognizes CJK sentence endings and preserves surrogate pairs', () => {
  const text = '这是第一句话。这是第二句话！🙂这是第三句话？';
  const chunks = chunkText(text, 10);

  assert.ok(chunks.length >= 3);
  assert.ok(chunks.every((chunk) => chunk.text.length <= 10));
  assert.equal(chunks.map((chunk) => chunk.text).join(''), text);
  assert.ok(chunks.every((chunk) => !chunk.text.startsWith('\ude42') && !chunk.text.endsWith('\ud83d')));
});

test('chunkText semantically caps one oversized sentence', () => {
  const text = 'Alpha clause, beta clause, gamma clause, delta clause, epsilon clause, zeta clause.';
  const chunks = chunkText(text, 24);

  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.text.length <= 24));
  assert.ok(chunks.some((chunk) => chunk.text.endsWith(',')));
});

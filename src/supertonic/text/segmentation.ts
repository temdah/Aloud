import { ABBREVIATION, ASCII_TERMINATORS, CJK_TERMINATORS } from './sentenceRules';
import type { SentenceSpan } from './segmentationTypes';

const ALL_TERMINATORS = /[.!?。！？]+/g;

function isAsciiTerminator(value: string): boolean {
  return /^[.!?]+$/.test(value);
}

function isValidAsciiBoundary(text: string, matchIndex: number, end: number, rangeStart: number): boolean {
  if (end < text.length && !/\s/.test(text[end])) return false;
  return !ABBREVIATION.test(text.slice(Math.max(rangeStart, matchIndex - 6), matchIndex + 1));
}

// Exclusive source offsets for sentence terminators and paragraph breaks.
// Callers use these offsets as stable joins between text, narration, and audio.
export function sentenceBoundaries(text: string): number[] {
  const boundaries: number[] = [];
  let match: RegExpExecArray | null;

  ASCII_TERMINATORS.lastIndex = 0;
  while ((match = ASCII_TERMINATORS.exec(text))) {
    const end = match.index + match[0].length;
    if (isValidAsciiBoundary(text, match.index, end, 0)) boundaries.push(end);
  }

  CJK_TERMINATORS.lastIndex = 0;
  while ((match = CJK_TERMINATORS.exec(text))) boundaries.push(match.index + match[0].length);

  const paragraphs = /\n\s*\n/g;
  while ((match = paragraphs.exec(text))) boundaries.push(match.index);

  return [...new Set(boundaries)].sort((a, b) => a - b);
}

// Find the first valid spoken sentence end inside [start, end), ignoring endings
// that would produce an unnaturally tiny lead. Returns end when no split helps.
export function firstSentenceEnd(text: string, start: number, end: number, minLength = 0): number {
  ALL_TERMINATORS.lastIndex = start;
  let match: RegExpExecArray | null;
  while ((match = ALL_TERMINATORS.exec(text)) && match.index < end) {
    const stop = Math.min(match.index + match[0].length, end);
    if (stop - start < minLength) continue;
    if (isAsciiTerminator(match[0]) && !isValidAsciiBoundary(text, match.index, stop, start)) continue;
    return stop;
  }
  return end;
}

// Sentence ranges preserve canonical offsets while trimming inter-sentence whitespace.
export function sentenceSpans(text: string): SentenceSpan[] {
  const spans: SentenceSpan[] = [];
  let start = nextNonSpace(text, 0);
  for (const boundary of sentenceBoundaries(text)) {
    if (boundary <= start) continue;
    const charEnd = previousNonSpace(text, boundary);
    if (charEnd > start) spans.push({ charStart: start, charEnd });
    start = nextNonSpace(text, boundary);
  }
  const charEnd = previousNonSpace(text, text.length);
  if (charEnd > start) spans.push({ charStart: start, charEnd });
  return spans;
}

function nextNonSpace(text: string, index: number): number {
  let current = index;
  while (current < text.length && /\s/.test(text[current])) current++;
  return current;
}

function previousNonSpace(text: string, index: number): number {
  let current = index;
  while (current > 0 && /\s/.test(text[current - 1])) current--;
  return current;
}

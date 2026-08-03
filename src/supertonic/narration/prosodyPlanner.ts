import type { ProsodyBoundary, ProsodyPlan } from './prosodyTypes';

const PAUSE_MS: Record<ProsodyBoundary, number> = {
  none: 0,
  continuation: 80,
  comma: 110,
  clause: 180,
  sentence: 240,
  question: 300,
  exclamation: 280,
  ellipsis: 360,
  paragraph: 420,
};

const CLOSING_MARKS = new Set(['"', "'", '\u201d', '\u2019', ')', ']', '}', '\uff09', '\u3011', '\u300b', '\u300d', '\u300f']);

function boundaryMark(text: string): string {
  let index = text.length - 1;
  while (index >= 0 && CLOSING_MARKS.has(text[index])) index--;
  return index >= 0 ? text[index] : '';
}

function addCadenceCue(text: string, cue: '.' | ','): string {
  let index = text.length;
  while (index > 0 && CLOSING_MARKS.has(text[index - 1])) index--;
  return `${text.slice(0, index)}${cue}${text.slice(index)}`;
}

function isParagraphGap(gap: string): boolean {
  return /\r?\n[ \t]*\r?\n/.test(gap);
}

function punctuationBoundary(text: string): ProsodyBoundary {
  if (/(?:\.{3}|\u2026)["'\u201d\u2019)\]}\uff09\u3011\u300b\u300d\u300f]*$/.test(text)) return 'ellipsis';
  const mark = boundaryMark(text);
  if (mark === '?' || mark === '\uff1f') return 'question';
  if (mark === '!' || mark === '\uff01') return 'exclamation';
  if (mark === '.' || mark === '\u3002') return 'sentence';
  if (mark === ';' || mark === ':' || mark === '\u2014' || mark === '\u2013' || mark === '\uff1b' || mark === '\uff1a') return 'clause';
  if (mark === ',' || mark === '\uff0c' || mark === '\u3001') return 'comma';
  return 'none';
}

// Converts one exact source span into a synthesis cue and a deterministic pause.
// Punctuation cues affect cadence; PCM silence guarantees the pause survives
// player transitions and slower-device scheduling jitter.
export function planProsody(documentText: string, charStart: number, charEnd: number): ProsodyPlan {
  const start = Math.max(0, Math.min(charStart, documentText.length));
  const end = Math.max(start, Math.min(charEnd, documentText.length));
  const source = documentText.slice(start, end).trim();
  if (!source) return { synthesisText: '', trailingPauseMs: 0, boundary: 'none' };

  const gap = documentText.slice(end, Math.min(documentText.length, end + 64));
  const paragraph = isParagraphGap(gap);
  const punctuation = punctuationBoundary(source);
  let boundary: ProsodyBoundary = paragraph ? 'paragraph' : punctuation;
  let synthesisText = source;

  if (punctuation === 'none') {
    const atDocumentEnd = end >= documentText.length;
    const splitAtWhitespace = end < documentText.length && /\s/.test(documentText[end]);
    if (paragraph || atDocumentEnd) {
      synthesisText = addCadenceCue(synthesisText, '.');
      boundary = paragraph ? 'paragraph' : 'sentence';
    } else if (splitAtWhitespace) {
      synthesisText = addCadenceCue(synthesisText, ',');
      boundary = 'continuation';
    }
  }

  return { synthesisText, trailingPauseMs: PAUSE_MS[boundary], boundary };
}

import type { ExtractedBlock, ExtractedDocument, ExtractedSentence } from '../pdf';
import { ABBREVIATION } from '../supertonic/text/sentenceRules';

// Assembles format-agnostic blocks (from the markdown/docx extractors) into the
// canonical ExtractedDocument the reader + chunker consume, with exact char
// offsets, sentence-split paragraphs, and synthetic pagination.

export type SourceBlock =
  | { kind: 'h2'; text: string }
  | { kind: 'p'; text: string };

// Formats without real pages still need pages for the reader's virtualization and
// PageScrubber, so we break every ~this-many chars.
const PAGE_CHAR_BUDGET = 1800;

// Sentence split mirroring the chunker's rules (shared sentenceRules).
function splitSentences(text: string, base: number): ExtractedSentence[] {
  const ends: number[] = [];
  const re = /[.!?。！？]+/g; // ASCII (guarded below) + CJK fullwidth terminators
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const end = m.index + m[0].length;
    if (!/[。！？]/.test(m[0])) {
      // ASCII: require following whitespace/EOF and skip abbreviations.
      if (end < text.length && !/\s/.test(text[end])) continue;
      if (ABBREVIATION.test(text.slice(Math.max(0, m.index - 6), m.index + 1))) continue;
    }
    ends.push(end);
  }
  if (ends.length === 0 || ends[ends.length - 1] < text.length) ends.push(text.length);

  const sentences: ExtractedSentence[] = [];
  let start = 0;
  for (const end of ends) {
    let s = start;
    while (s < end && /\s/.test(text[s])) s++;
    let e = end;
    while (e > s && /\s/.test(text[e - 1])) e--;
    if (e > s) sentences.push({ text: text.slice(s, e), charStart: base + s, charEnd: base + e });
    start = end;
  }
  return sentences;
}

export function buildDocument(source: SourceBlock[]): ExtractedDocument {
  const blocks: ExtractedBlock[] = [];
  let text = '';
  let page = 1;
  let pageChars = 0;

  for (const sb of source) {
    const body = sb.text.trim();
    if (!body) continue;

    // A heading with content already above it rolls to the next page.
    if (sb.kind === 'h2' && pageChars > 0 && pageChars >= PAGE_CHAR_BUDGET * 0.6) {
      page += 1;
      pageChars = 0;
    }

    if (text.length > 0) text += '\n\n';
    const charStart = text.length;
    text += body;
    const charEnd = text.length;

    if (sb.kind === 'h2') {
      // Append sentence-final punctuation to the synthesized text so the heading
      // reads with a pause + falling intonation instead of running straight into
      // the body. It sits outside the block range, so the reader shows a clean
      // title and the highlight is unaffected.
      if (!/[.!?…:]$/.test(body)) text += '.';
      blocks.push({ kind: 'h2', text: body, charStart, charEnd, page, indent: 0 });
    } else {
      const sentences = splitSentences(body, charStart);
      blocks.push({ kind: 'p', sentences, charStart, charEnd, page, indent: 0 });
    }

    pageChars += body.length + 2;
    if (pageChars >= PAGE_CHAR_BUDGET) {
      page += 1;
      pageChars = 0;
    }
  }

  // page may have advanced past the last real content — clamp to the highest used.
  const pageCount = blocks.length > 0 ? blocks[blocks.length - 1].page : 0;
  return { text, blocks, pageCount };
}

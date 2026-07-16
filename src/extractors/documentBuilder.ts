import type { ExtractedBlock, ExtractedDocument, ExtractedSentence } from '../pdf';
import { ABBREVIATION } from '../supertonic/text/sentenceRules';

// A format-agnostic logical block. Markdown/docx extractors emit these; the
// builder turns them into the canonical ExtractedDocument the reader + chunker
// consume (PDF produces that shape directly from PDF.js).
export type SourceBlock =
  | { kind: 'h2'; text: string }
  | { kind: 'p'; text: string };

// Roughly how many characters fill one synthetic "page". The reader virtualizes
// by page (FlatList of pages 1..N) and PageScrubber jumps by page, so formats
// without real pages still need pagination for scroll/geometry to work.
const PAGE_CHAR_BUDGET = 1800;

// Splits a paragraph into sentences, returning offsets relative to the
// paragraph start. Mirrors the chunker's boundary rules (shared sentenceRules)
// so highlight ranges and playback chunks stay visually consistent.
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

// Assembles logical blocks into a canonical text stream with exact char offsets,
// sentence-split paragraphs, and synthetic pagination.
export function buildDocument(source: SourceBlock[]): ExtractedDocument {
  const blocks: ExtractedBlock[] = [];
  let text = '';
  let page = 1;
  let pageChars = 0;

  for (const sb of source) {
    const body = sb.text.trim();
    if (!body) continue;

    // A heading starting a new page that already has content rolls to the next.
    if (sb.kind === 'h2' && pageChars > 0 && pageChars >= PAGE_CHAR_BUDGET * 0.6) {
      page += 1;
      pageChars = 0;
    }

    if (text.length > 0) text += '\n\n';
    const charStart = text.length;
    text += body;
    const charEnd = text.length;

    if (sb.kind === 'h2') {
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

  // If the final page ended exactly on the budget, page was already advanced
  // past the last real content — clamp pageCount to the highest used page.
  const pageCount = blocks.length > 0 ? blocks[blocks.length - 1].page : 0;
  return { text, blocks, pageCount };
}

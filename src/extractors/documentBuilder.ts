import type { ExtractedBlock, ExtractedDocument, ExtractedSentence } from '../pdf';
import { sentenceSpans } from '../supertonic/text/segmentation';

// Assembles format-agnostic blocks (from the markdown/docx extractors) into the
// canonical ExtractedDocument the reader + chunker consume, with exact char
// offsets, sentence-split paragraphs, and synthetic pagination.

export type SourceBlock =
  | { kind: 'h2'; text: string }
  | { kind: 'p'; text: string };

// Formats without real pages still need pages for the reader's virtualization and
// PageScrubber, so we break every ~this-many chars.
const PAGE_CHAR_BUDGET = 1800;

// Use the narration segmenter so every tappable reader sentence starts at the
// same stable offset as its reusable audio anchor.
function splitSentences(text: string, base: number): ExtractedSentence[] {
  return sentenceSpans(text).map(({ charStart, charEnd }) => ({
    text: text.slice(charStart, charEnd),
    charStart: base + charStart,
    charEnd: base + charEnd,
  }));
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

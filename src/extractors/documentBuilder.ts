import type { ExtractedBlock, ExtractedDocument, ExtractedSentence } from '../pdf';
import { sentenceSpans } from '../supertonic';
import type { SourceBlock } from './documentBuilderTypes';

// Assembles format-agnostic blocks (from the markdown/docx extractors) into the
// canonical ExtractedDocument the reader + chunker consume, with exact char
// offsets, sentence-split paragraphs, and synthetic pagination.

// Synthetic pages keep non-PDF documents compatible with reader virtualization.
const PAGE_CHAR_BUDGET = 1800;

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

  const pageCount = blocks.length > 0 ? blocks[blocks.length - 1].page : 0;
  return { text, blocks, pageCount };
}

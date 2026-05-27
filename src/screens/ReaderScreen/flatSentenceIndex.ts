import type { ExtractedBlock } from '../../pdf';
import type { FlatSentence } from '../../types';

// Flat list of readable sentences (paragraph blocks only) with their block +
// sentence indices — drives sentence-level highlighting.
export function flatSentenceIndex(blocks: ExtractedBlock[]): FlatSentence[] {
  const list: FlatSentence[] = [];
  blocks.forEach((b, bi) => {
    if (b.kind === 'p') b.sentences.forEach((s, si) => list.push({ bi, si, text: s.text }));
  });
  return list;
}

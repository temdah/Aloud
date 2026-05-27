import type { FlatSentence, PageBlock } from '../../types';

export function flatSentenceIndex(blocks: PageBlock[]): FlatSentence[] {
  const list: FlatSentence[] = [];
  blocks.forEach((b, bi) => {
    if (b.kind === 'p') b.sentences.forEach((s, si) => list.push({ bi, si, text: s }));
  });
  return list;
}

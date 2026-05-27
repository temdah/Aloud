// Shape of reader page content. Real instances come from the PDF.js -> RN
// sentence bridge; the app ships with no sample content.

export type PageBlock =
  | { kind: 'h2'; text: string }
  | { kind: 'p'; sentences: string[] };

export type FlatSentence = { bi: number; si: number; text: string };

export function flatSentenceIndex(blocks: PageBlock[]): FlatSentence[] {
  const list: FlatSentence[] = [];
  blocks.forEach((b, bi) => {
    if (b.kind === 'p') b.sentences.forEach((s, si) => list.push({ bi, si, text: s }));
  });
  return list;
}

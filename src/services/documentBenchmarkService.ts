import { loadExtractedText } from '../pdf';
import { loadChunks, maxChunkLen, qualityProfile, type Quality } from '../supertonic';
import type { ImportedDocument } from '../types';
import { benchmarkRow, percentile } from './benchmarkFormatting';

export function analyzeDocumentForBenchmark(document: ImportedDocument, quality: Quality): string[] {
  const extracted = loadExtractedText(document.docHash);
  if (!extracted) {
    return [`\n"${document.title}" — not extracted yet. Open it in the reader once, then retry.`];
  }

  const unitLength = qualityProfile(quality).unitLen;
  const chunks = loadChunks(document.docHash, extracted.text, unitLength);
  const lines = [
    `\n══ ${document.title} (${document.kind}) ══`,
    benchmarkRow('chars / pages', `${extracted.text.length} / ${extracted.pageCount}`),
  ];

  const kinds: Record<string, number> = {};
  for (const block of extracted.blocks) kinds[block.kind] = (kinds[block.kind] ?? 0) + 1;
  lines.push(benchmarkRow('blocks', Object.entries(kinds).map(([kind, count]) => `${kind}:${count}`).join('  ') || '(none)'));

  const sizes = chunks.map((chunk) => chunk.text.length);
  const cap = maxChunkLen(extracted.text, unitLength);
  const largest = sizes.length ? Math.max(...sizes) : 0;
  const smallest = sizes.length ? Math.min(...sizes) : 0;
  const average = sizes.length ? Math.round(sizes.reduce((sum, size) => sum + size, 0) / sizes.length) : 0;
  const overCap = sizes.filter((size) => size > cap).length;
  lines.push(benchmarkRow(`chunks (cap ${cap})`, `${chunks.length}  · avg ${average} · p95 ${percentile(sizes, 0.95)} · min ${smallest} · max ${largest} · over-cap ${overCap}`));

  const headings = extracted.blocks.filter((block) => block.kind === 'h2');
  lines.push(benchmarkRow('headings', String(headings.length)));
  const suspectedHeadings: string[] = [];
  for (const block of extracted.blocks) {
    if (block.kind !== 'p') continue;
    const text = extracted.text.slice(block.charStart, block.charEnd).trim();
    if (text.length > 0 && text.length <= 60 && !/[.!?:;]$/.test(text)) suspectedHeadings.push(text);
  }
  lines.push(benchmarkRow('suspected missed headings', String(suspectedHeadings.length)));
  suspectedHeadings.slice(0, 8).forEach((text) => lines.push(`    · ${text}`));
  lines.push('  ── spoken preview ──');
  lines.push(extracted.text.slice(0, 700).replace(/\n{2,}/g, '\n  ¶ '));
  return lines;
}

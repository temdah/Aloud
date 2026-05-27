import { Directory, File, Paths } from 'expo-file-system';
import type { ExtractedBlock } from './pdfExtractionTypes';

// Per-page rendered-height geometry. We can't know exact heights without
// rendering, but a content-derived ESTIMATE is enough to give FlatList an
// offset table (getItemLayout) so it jumps straight to a page instead of
// rendering through every page in between. Real heights from onLayout refine
// the table and are cached per document, so reopening is exact.

const READER_LINE = 28;
const HEADING_LINE = 26;
const TOC_LINE = 30;
const PARA_MARGIN = 14;
const HEADING_MARGIN = 18;
const READER_CPL = 34; // approx chars per line at the reader font + card width
const HEADING_CPL = 26;
const PAGE_CHROME = 120; // "Page N" divider + card padding + section margins
const DEFAULT_PAGE = 560; // a page we have no content for yet (matches the placeholder card)

function estimateBlockHeight(b: ExtractedBlock): number {
  if (b.kind === 'h2') {
    return Math.max(1, Math.ceil(b.text.length / HEADING_CPL)) * HEADING_LINE + HEADING_MARGIN;
  }
  if (b.kind === 'toc') {
    const len = (b.title?.length ?? 0) + 4;
    return Math.max(1, Math.ceil(len / READER_CPL)) * TOC_LINE;
  }
  if (b.kind === 'pageHeader') {
    return READER_LINE + PARA_MARGIN; // one greyed line + its separating rule
  }
  const len = b.sentences.reduce((s, x) => s + x.text.length + 1, 0);
  return Math.max(1, Math.ceil(len / READER_CPL)) * READER_LINE + PARA_MARGIN;
}

// Estimated height for every page (index 0 = page 1). Pages with no blocks yet
// get a neutral default so far jumps don't land wildly short during streaming.
export function estimatePageHeights(blocks: ExtractedBlock[], pageCount: number): number[] {
  const sums = new Array(pageCount).fill(0);
  const has = new Array(pageCount).fill(false);
  for (const b of blocks) {
    const i = b.page - 1;
    if (i < 0 || i >= pageCount) continue;
    sums[i] += estimateBlockHeight(b);
    has[i] = true;
  }
  const out = new Array(pageCount);
  for (let i = 0; i < pageCount; i++) out[i] = has[i] ? PAGE_CHROME + sums[i] : DEFAULT_PAGE;
  return out;
}

const GEOM_DIR = 'geometry';
const GEOM_VERSION = 1;

type GeometryFile = { version: number; pageCount: number; heights: number[] };

function geometryFile(docHash: string): File {
  const dir = new Directory(Paths.document, GEOM_DIR);
  if (!dir.exists) dir.create({ intermediates: true });
  return new File(dir, `${docHash}.json`);
}

// Cached real heights for a doc, or null if absent / stale (page count changed).
export function loadGeometry(docHash: string, pageCount: number): number[] | null {
  const file = geometryFile(docHash);
  if (!file.exists) return null;
  try {
    const data = JSON.parse(file.textSync()) as GeometryFile;
    if (data.version !== GEOM_VERSION || data.pageCount !== pageCount || data.heights.length !== pageCount) return null;
    return data.heights;
  } catch {
    return null;
  }
}

export function saveGeometry(docHash: string, pageCount: number, heights: number[]): void {
  if (heights.length !== pageCount) return;
  const file = geometryFile(docHash);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify({ version: GEOM_VERSION, pageCount, heights } satisfies GeometryFile));
}

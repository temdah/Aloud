import { Directory, File, Paths } from 'expo-file-system';
import type { ExtractedDocument } from './pdfExtractionTypes';

// Extracted text is expensive to produce, so cache it per document
// (documentDirectory/text/<docHash>.json) and reuse it on reopen.
const TEXT_DIR = 'text';

// Bump when the extraction/reflow logic changes so stale caches are re-extracted.
// v10: images extracted + rendered inline.
const EXTRACTOR_VERSION = 10;

type CacheEnvelope = { version: number; doc: ExtractedDocument };

function cacheFile(docHash: string): File {
  const dir = new Directory(Paths.document, TEXT_DIR);
  if (!dir.exists) dir.create({ intermediates: true });
  return new File(dir, `${docHash}.json`);
}

export function loadExtractedText(docHash: string): ExtractedDocument | null {
  const file = cacheFile(docHash);
  if (!file.exists) return null;
  try {
    const envelope = JSON.parse(file.textSync()) as CacheEnvelope;
    if (envelope.version !== EXTRACTOR_VERSION) return null;
    return envelope.doc;
  } catch {
    return null;
  }
}

export function saveExtractedText(docHash: string, doc: ExtractedDocument): void {
  const file = cacheFile(docHash);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify({ version: EXTRACTOR_VERSION, doc } satisfies CacheEnvelope));
}

export function deleteExtractedText(docHash: string): void {
  const file = cacheFile(docHash);
  if (file.exists) file.delete();
}

import { Directory, File, Paths } from 'expo-file-system';
import type { ExtractedDocument } from './pdfExtractionTypes';
import type { ExtractedTextCacheEnvelope } from './extractedTextCacheTypes';

// Per-document cache of the extracted text (documentDirectory/text/<docHash>.json),
// reused on reopen unless the extractor version changed.
const TEXT_DIR = 'text';

// Bump when extraction/reflow changes so stale caches are re-extracted.
// v10: inline images. v11: cross-page paragraph merge + smarter dehyphenation.
// v12: headings get sentence-final punctuation in the spoken stream.
// v13: standalone bold markdown lines detected as headings.
// v14: pdf TOC no longer spoken; numbered/prefixed section headings detected.
const EXTRACTOR_VERSION = 14;

function cacheFile(docHash: string): File {
  const dir = new Directory(Paths.document, TEXT_DIR);
  if (!dir.exists) dir.create({ intermediates: true });
  return new File(dir, `${docHash}.json`);
}

export function loadExtractedText(docHash: string): ExtractedDocument | null {
  const file = cacheFile(docHash);
  if (!file.exists) return null;
  try {
    const envelope = JSON.parse(file.textSync()) as ExtractedTextCacheEnvelope;
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
  file.write(JSON.stringify({ version: EXTRACTOR_VERSION, doc } satisfies ExtractedTextCacheEnvelope));
}

export function deleteExtractedText(docHash: string): void {
  const file = cacheFile(docHash);
  if (file.exists) file.delete();
}

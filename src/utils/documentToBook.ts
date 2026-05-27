import type { Book, ImportedDocument } from '../types';

// CoverThumb cycles through a fixed set of hues; pick one deterministically
// from the content hash so a document keeps the same tint across launches.
const COVER_COUNT = 5;

function coverIndex(docHash: string): number {
  let sum = 0;
  for (let i = 0; i < docHash.length; i++) sum += docHash.charCodeAt(i);
  return sum % COVER_COUNT;
}

// Maps an imported PDF to the library view-model. Fields the PDF can't supply
// yet (author, page count, progress) stay empty/zero until later stages fill
// them — no invented values.
export function documentToBook(doc: ImportedDocument): Book {
  return {
    id: doc.docHash,
    title: doc.title,
    author: '',
    pages: doc.pageCount ?? 0,
    page: 0,
    cover: coverIndex(doc.docHash),
    opened: '',
    progress: 0,
    eta: '',
    state: 'fresh',
  };
}

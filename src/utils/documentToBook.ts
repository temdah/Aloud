import { COVER_COUNT } from '../theme';
import type { Book, ImportedDocument } from '../types';

// Maps an imported document to the library list view-model.

// Deterministic tint from the content hash, so a doc keeps its colour across
// launches unless the user pinned one (doc.cover).
function coverIndex(docHash: string): number {
  let sum = 0;
  for (let i = 0; i < docHash.length; i++) sum += docHash.charCodeAt(i);
  return sum % COVER_COUNT;
}

export function documentToBook(doc: ImportedDocument): Book {
  return {
    id: doc.docHash,
    title: doc.title,
    author: '',
    pages: doc.pageCount ?? 0,
    page: 0,
    cover: doc.cover ?? coverIndex(doc.docHash),
    opened: '',
    progress: 0,
    eta: '',
    state: 'fresh',
  };
}

import type { DocumentKind } from '../types';

// Maps a source file name to the document kind by extension. Returns null for
// unsupported types so the picker can reject them.
export function kindForName(name: string): DocumentKind | null {
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'md' || ext === 'markdown' || ext === 'mdown' || ext === 'mkd') return 'markdown';
  if (ext === 'docx') return 'docx';
  return null;
}

// The stored-file extension for a kind (the copied library file keeps a
// canonical extension so later stages can re-open it without the original name).
export function extensionForKind(kind: DocumentKind): string {
  return kind === 'markdown' ? 'md' : kind;
}

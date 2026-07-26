import type { DocumentKind } from '../types';

// Maps file names <-> document kinds by extension.

export function kindForName(name: string): DocumentKind | null {
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'md' || ext === 'markdown' || ext === 'mdown' || ext === 'mkd') return 'markdown';
  if (ext === 'docx') return 'docx';
  return null;
}

// Canonical stored extension, so later stages can reopen the copied file without
// the original name.
export function extensionForKind(kind: DocumentKind): string {
  return kind === 'markdown' ? 'md' : kind;
}

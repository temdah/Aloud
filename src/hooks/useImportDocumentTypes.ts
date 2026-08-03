import type { ImportedDocument } from '../types';

export type ImportDocumentState = {
  importing: boolean;
  error?: string;
  importDocument: () => Promise<ImportedDocument | null>;
};

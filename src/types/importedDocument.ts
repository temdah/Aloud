// A document the user imported. The copied file lives in the app's document
// directory; docHash namespaces its TTS cache + manifest.
export type DocumentKind = 'pdf' | 'markdown' | 'docx';

export type ImportedDocument = {
  id: string; // equal to docHash
  title: string;
  fileUri: string;
  kind?: DocumentKind; // absent ⇒ treated as 'pdf'
  lang?: string; // absent ⇒ the global default in settings
  docHash: string;
  sizeBytes: number;
  addedAt: number;
  pageCount?: number;
  // Cover-palette index; absent ⇒ derived from the hash. Drives the thumbnail
  // and the media-notification tint.
  cover?: number;
  resumeChunkIdx?: number;
};

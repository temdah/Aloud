import { File } from 'expo-file-system';
import { clearExtractedImages, deleteExtractedText } from '../pdf';
import { useDocumentsStore } from '../stores';
import { clearDocumentCache } from '../supertonic';
import type { ImportedDocument } from '../types';

export function deleteDocument(document: ImportedDocument): void {
  const documents = useDocumentsStore.getState();
  clearDocumentCache(document.docHash);
  documents.clearAudiobook(document.docHash);
  deleteExtractedText(document.docHash);
  clearExtractedImages(document.docHash);

  try {
    new File(document.fileUri).delete();
  } catch {}

  documents.removeDocument(document.docHash);
}

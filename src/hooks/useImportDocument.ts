import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { useCallback, useState } from 'react';
import { useDocumentsStore } from '../stores';
import type { ImportedDocument } from '../types';
import { stableHash } from '../utils';

const LIBRARY_SUBDIR = 'library';

function libraryDirectory(): Directory {
  const dir = new Directory(Paths.document, LIBRARY_SUBDIR);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

function stripExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

export type ImportDocumentState = {
  importing: boolean;
  error?: string;
  /** Opens the picker, copies + registers the PDF; resolves to it (or null if cancelled). */
  importDocument: () => Promise<ImportedDocument | null>;
};

// Imports a PDF: pick → copy into the document directory under a content-hashed
// name → register in the documents store. The copied file is what every later
// stage (PDF.js viewer, chunk cache) reads, so it survives the picker's cache.
export function useImportDocument(): ImportDocumentState {
  const addDocument = useDocumentsStore((s) => s.addDocument);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const importDocument = useCallback(async () => {
    setError(undefined);
    setImporting(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || result.assets.length === 0) return null;

      const asset = result.assets[0];
      const source = new File(asset.uri);
      const sizeBytes = asset.size ?? source.size;
      // docHash namespaces the TTS cache + manifest and dedupes re-imports.
      // Prefer the file's native md5; fall back to a name+size signature.
      const docHash = source.md5 ?? stableHash(`${asset.name}:${sizeBytes}`);

      const destination = new File(libraryDirectory(), `${docHash}.pdf`);
      if (!destination.exists) await source.copy(destination);

      const doc: ImportedDocument = {
        id: docHash,
        title: stripExtension(asset.name),
        fileUri: destination.uri,
        docHash,
        sizeBytes,
        addedAt: Date.now(),
      };
      addDocument(doc);
      return doc;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setImporting(false);
    }
  }, [addDocument]);

  return { importing, error, importDocument };
}

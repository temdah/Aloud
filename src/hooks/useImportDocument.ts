import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { useCallback, useState } from 'react';
import { extensionForKind, kindForName } from '../extractors';
import { useDocumentsStore } from '../stores';
import type { ImportedDocument } from '../types';
import { stableHash } from '../utils';
import type { ImportDocumentState } from './useImportDocumentTypes';

// Imports a document: pick → copy into the document directory under a
// content-hashed name → register in the store. The copied file is what every
// later stage reads, so it outlives the picker's cache.

// .md often reports text/plain or octet-stream on Android, so we widen the
// picker filter and validate by extension after picking.
const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/markdown',
  'text/x-markdown',
  'text/plain',
];

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

export function useImportDocument(): ImportDocumentState {
  const addDocument = useDocumentsStore((s) => s.addDocument);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const importDocument = useCallback(async () => {
    setError(undefined);
    setImporting(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ACCEPTED_TYPES,
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || result.assets.length === 0) return null;

      const asset = result.assets[0];
      const kind = kindForName(asset.name);
      if (!kind) {
        setError('Unsupported file type. Import a PDF, Markdown (.md), or Word (.docx) file.');
        return null;
      }

      const source = new File(asset.uri);
      const sizeBytes = asset.size ?? source.size;
      // docHash namespaces the TTS cache + manifest and dedupes re-imports; prefer
      // the file's native md5, fall back to a name+size signature.
      const docHash = source.md5 ?? stableHash(`${asset.name}:${sizeBytes}`);

      const destination = new File(libraryDirectory(), `${docHash}.${extensionForKind(kind)}`);
      if (!destination.exists) await source.copy(destination);

      const doc: ImportedDocument = {
        id: docHash,
        title: stripExtension(asset.name),
        fileUri: destination.uri,
        kind,
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

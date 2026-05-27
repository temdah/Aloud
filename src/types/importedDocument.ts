// A PDF the user has imported into their library. The copied file lives in the
// app's document directory; docHash namespaces its TTS cache + manifest.
export type ImportedDocument = {
  /** Stable identifier — equal to docHash. */
  id: string;
  /** Display title (source file name without extension). */
  title: string;
  /** file:// URI of the copied PDF inside the document directory. */
  fileUri: string;
  /** Content signature — cache namespace and dedupe key. */
  docHash: string;
  /** Size of the copied PDF in bytes. */
  sizeBytes: number;
  /** Import time (epoch ms). */
  addedAt: number;
  /** Page count — known once the PDF text layer is parsed. */
  pageCount?: number;
  /** Playback resume cursor — index of the last chunk reached. */
  resumeChunkIdx?: number;
};

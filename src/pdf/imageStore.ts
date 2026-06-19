import { Directory, File, Paths } from 'expo-file-system';

// Per-document store for images lifted out of a PDF during extraction:
// documentDirectory/images/<docHash>/<id>.jpg. The extraction WebView can't write
// files, so it sends each image as a base64 data: URI; we decode + persist here
// and the ExtractedBlock keeps only the resulting file uri (cache stays small).
const IMG_ROOT = 'images';

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = new Uint8Array(256);
for (let i = 0; i < B64_ALPHABET.length; i++) B64_LOOKUP[B64_ALPHABET.charCodeAt(i)] = i;

// Decode standard base64 to bytes (no atob dependency — not guaranteed in RN).
function base64ToBytes(b64: string): Uint8Array {
  const s = b64.replace(/\s/g, '');
  const len = s.length;
  if (len === 0) return new Uint8Array(0);
  let padding = 0;
  if (s[len - 1] === '=') padding++;
  if (s[len - 2] === '=') padding++;
  const byteLen = Math.floor((len * 3) / 4) - padding;
  const bytes = new Uint8Array(byteLen);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const n =
      (B64_LOOKUP[s.charCodeAt(i)] << 18) |
      (B64_LOOKUP[s.charCodeAt(i + 1)] << 12) |
      (B64_LOOKUP[s.charCodeAt(i + 2)] << 6) |
      B64_LOOKUP[s.charCodeAt(i + 3)];
    if (p < byteLen) bytes[p++] = (n >> 16) & 0xff;
    if (p < byteLen) bytes[p++] = (n >> 8) & 0xff;
    if (p < byteLen) bytes[p++] = n & 0xff;
  }
  return bytes;
}

function imagesDir(docHash: string): Directory {
  const dir = new Directory(Paths.document, IMG_ROOT, docHash);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** Write a base64 `data:` image to the doc's image dir; returns its file:// uri. */
export function saveExtractedImage(docHash: string, id: string, dataUri: string): string {
  const comma = dataUri.indexOf(',');
  const b64 = comma >= 0 ? dataUri.slice(comma + 1) : dataUri;
  const bytes = base64ToBytes(b64);
  const file = new File(imagesDir(docHash), `${id}.jpg`);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
  return file.uri;
}

/** Remove all extracted images for a document (e.g. before a re-extract). */
export function clearExtractedImages(docHash: string): void {
  const dir = new Directory(Paths.document, IMG_ROOT, docHash);
  if (dir.exists) dir.delete();
}

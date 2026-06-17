import AacCodecModule from './src/AacCodecModule';

// expo-file-system uris look like `file:///data/...`; the native layer opens raw
// filesystem paths, so strip the scheme and decode percent-escapes (e.g. spaces).
function toPath(uri: string): string {
  if (!uri.startsWith('file://')) return uri;
  return decodeURIComponent(uri.slice('file://'.length));
}

/**
 * Encode one or more 16-bit PCM mono WAV files into a single AAC (.m4a) file via
 * Android's built-in MediaCodec — no bundled codec library. Used for both
 * per-chunk caching (one WAV) and the concatenated audiobook (N WAVs stitched
 * into one continuous stream). All inputs must share the source rate/channels
 * (they do — same model). Resolves with `dstUri`.
 *
 * @param srcWavUris source WAV uris/paths, in playback order
 * @param dstUri destination `.m4a` uri/path
 * @param bitrate AAC-LC bitrate in bits/s (default 64000 — good for mono speech)
 */
export function encodeWavsToM4a(srcWavUris: string[], dstUri: string, bitrate = 64000): Promise<string> {
  return AacCodecModule.encodeWavsToM4a(srcWavUris.map(toPath), toPath(dstUri), bitrate);
}

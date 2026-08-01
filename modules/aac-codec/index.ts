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

/**
 * Encode raw 16-bit mono PCM straight to an AAC `.m4a` — no temp WAV round-trip.
 * `pcm16` is little-endian 16-bit samples (no header). Resolves with `dstUri`.
 */
export function encodePcmToM4a(pcm16: Uint8Array, sampleRate: number, dstUri: string, bitrate = 64000): Promise<string> {
  return AacCodecModule.encodePcmToM4a(pcm16, sampleRate, 1, toPath(dstUri), bitrate);
}

export type FloatPcmEncodeResult = { uri: string; pcmMs: number };

/**
 * Convert a float waveform to 16-bit PCM and encode it on the native AAC worker.
 * Passing a byte view avoids an O(samples) conversion on the JavaScript thread.
 */
export function encodeFloatPcmToM4a(
  waveform: Float32Array,
  sampleRate: number,
  dstUri: string,
  bitrate = 64000,
): Promise<FloatPcmEncodeResult> {
  const float32Bytes = new Uint8Array(waveform.buffer, waveform.byteOffset, waveform.byteLength);
  return AacCodecModule.encodeFloatPcmToM4a(float32Bytes, sampleRate, 1, toPath(dstUri), bitrate);
}

/**
 * Losslessly stitch several AAC `.m4a` files into one continuous `.m4a` — no
 * re-encode (compressed samples are copied and re-muxed). Used to merge a
 * fully-rendered book's per-chunk cache into a single audiobook file so the OS
 * media notification can show a real whole-book timeline. Resolves with each
 * source clip's start offset (ms) in the stitched file, aligned with the inputs.
 */
export function concatM4a(srcM4aUris: string[], dstUri: string): Promise<number[]> {
  return AacCodecModule.concatM4a(srcM4aUris.map(toPath), toPath(dstUri));
}

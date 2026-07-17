import { requireNativeModule } from 'expo-modules-core';

type AacCodecNativeModule = {
  encodeWavsToM4a(srcWavPaths: string[], dstPath: string, bitrate: number): Promise<string>;
  encodePcmToM4a(pcm16: Uint8Array, sampleRate: number, channels: number, dstPath: string, bitrate: number): Promise<string>;
  /** Resolves each source clip's start offset (ms) in the stitched file. */
  concatM4a(srcM4aPaths: string[], dstPath: string): Promise<number[]>;
};

// Backed by the native AacCodecModule (Kotlin + MediaCodec). Android-only.
export default requireNativeModule<AacCodecNativeModule>('AacCodec');

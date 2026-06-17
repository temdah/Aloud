import { requireNativeModule } from 'expo-modules-core';

type AacCodecNativeModule = {
  encodeWavsToM4a(srcWavPaths: string[], dstPath: string, bitrate: number): Promise<string>;
};

// Backed by the native AacCodecModule (Kotlin + MediaCodec). Android-only.
export default requireNativeModule<AacCodecNativeModule>('AacCodec');

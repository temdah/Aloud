export type FloatPcmEncodeResult = { uri: string; pcmMs: number };

export type AacCodecNativeModule = {
  encodeWavsToM4a(srcWavPaths: string[], dstPath: string, bitrate: number): Promise<string>;
  encodePcmToM4a(pcm16: Uint8Array, sampleRate: number, channels: number, dstPath: string, bitrate: number): Promise<string>;
  encodeFloatPcmToM4a(
    float32Bytes: Uint8Array,
    sampleRate: number,
    channels: number,
    dstPath: string,
    bitrate: number,
    trailingSilenceFrames: number,
  ): Promise<FloatPcmEncodeResult>;
  concatM4a(srcM4aPaths: string[], dstPath: string): Promise<number[]>;
};

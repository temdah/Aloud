import { requireNativeModule } from 'expo-modules-core';
import type { AacCodecNativeModule } from './AacCodecTypes';

// Backed by the native AacCodecModule (Kotlin + MediaCodec). Android-only.
export default requireNativeModule<AacCodecNativeModule>('AacCodec');

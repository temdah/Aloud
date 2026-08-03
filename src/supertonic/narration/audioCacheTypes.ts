import type { NarrationTone } from '../../types';

export type ChunkTiming = { seconds: number };
export type AudiobookIndex = { version: number; startsSec: number[] };
export type ProfileMeta = { modelId: string; voiceId: string; steps: number; lang: string; tone: NarrationTone };
export type CachedProfile = { hash: string; meta: ProfileMeta | null; count: number; bytes: number };

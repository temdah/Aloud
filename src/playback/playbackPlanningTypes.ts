import type { Chunk } from '../types';

export type Lead = { chunk: Chunk; anchorIdx: number; resumeIdx: number };
export type FastStart = { lead: Lead; remainder: Lead | null };

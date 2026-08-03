import type { NarrationTone, ResolvedNarrationTone } from '../../types';

export type TonePlan = {
  requested: NarrationTone;
  resolved: ResolvedNarrationTone;
  synthesisSpeed: number;
  pauseScale: number;
  academicDocument: boolean;
};

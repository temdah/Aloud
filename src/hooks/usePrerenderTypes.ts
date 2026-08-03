import type { NarrationSettings } from '../supertonic';

export type PrerenderStatus = 'idle' | 'running' | 'done' | 'cancelled' | 'error';

export type PrerenderState = {
  status: PrerenderStatus;
  done: number;
  total: number;
  progress: number;
  error?: string;
  start: (settings: NarrationSettings) => void;
  cancel: () => void;
};

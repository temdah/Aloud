import type { NarrationPlan } from '../supertonic/narration/narrationPlanTypes';
import type { Quality } from '../supertonic/qualityProfile';
import type { Chunk } from '../types';

export type UsePlaybackOptions = {
  docHash: string;
  plan: NarrationPlan;
  modelId: string | null;
  voiceId: string;
  speed: number;
  steps: number;
  lang?: string;
  quality: Quality;
  title?: string;
  artist?: string;
  onSpeedChange?: (speed: number) => void;
};

export type Playback = {
  ready: boolean;
  modelLoadFailed: boolean;
  playing: boolean;
  loading: boolean;
  engaged: boolean;
  started: boolean;
  currentChunk: Chunk | null;
  total: number;
  positionSec: number;
  durationSec: number;
  docPositionSec: number;
  docDurationSec: number;
  timelineReady: boolean;
  perfWarning: boolean;
  error: string | null;
  retry: () => void;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
  seekToChunk: (index: number) => void;
  select: (charOffset: number) => void;
  playFrom: (charOffset: number) => void;
  goTo: (charOffset: number) => void;
  seek: (fraction: number) => void;
  seekToTime: (sec: number) => void;
  stop: () => void;
  halt: () => void;
};

import type { SleepTimer } from '../hooks/useSleepTimer';
import type { NarrationPlan } from '../supertonic/narration/narrationPlanTypes';
import type { Quality } from '../supertonic/qualityProfile';
import type { ImportedDocument } from '../types';
import type { Playback } from './playbackTypes';

export type ActiveDoc = {
  doc: ImportedDocument;
  plan: NarrationPlan;
  modelId: string | null;
  voiceId: string;
  speed: number;
  steps: number;
  lang: string;
  quality: Quality;
  onSpeedChange?: (speed: number) => void;
};

export type PlaybackContextValue = {
  playback: Playback;
  activeDoc: ActiveDoc | null;
  setActiveDoc: (doc: ActiveDoc) => void;
  playDocument: (doc: ActiveDoc, fromOffset?: number) => void;
  clearActiveDoc: () => void;
  sleep: SleepTimer;
};

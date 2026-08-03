import type { NarrationPlan, Quality } from '../supertonic';
import type { ImportedDocument, NarrationTone } from '../types';
import type { SleepTimer } from './sleepTimerTypes';
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
  tone: NarrationTone;
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

import type { Quality } from '../supertonic';
import type { NarrationTone } from '../types';

export type SettingsState = {
  modelId: string | null;
  voiceId: string;
  lang: string;
  speed: number;
  steps: number;
  quality: Quality;
  tone: NarrationTone;
  keepEngineWarm: boolean;
  onboarded: boolean;
  termsAcceptedAt: number;
  perfTipSuppressed: boolean;
  perfTipLastShown: number;
  setModelId: (modelId: string | null) => void;
  setVoice: (voiceId: string) => void;
  setLang: (lang: string) => void;
  setSpeed: (speed: number) => void;
  setSteps: (steps: number) => void;
  setQuality: (quality: Quality) => void;
  setTone: (tone: NarrationTone) => void;
  setKeepEngineWarm: (keepEngineWarm: boolean) => void;
  setOnboarded: (onboarded: boolean) => void;
  acceptTerms: () => void;
  suppressPerfTip: () => void;
  markPerfTipShown: () => void;
};

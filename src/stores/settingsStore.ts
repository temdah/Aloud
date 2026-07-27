import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_VOICE } from '../supertonic';
import { fileStorage } from './fileStorage';

// Global narration settings (model, voice, language, speed, steps), persisted.

type SettingsState = {
  modelId: string | null;
  voiceId: string;
  // A document may override this; absent an override, narration falls back here.
  lang: string;
  speed: number;
  steps: number;
  // First-run wizard seen (model downloaded before the first play prompt).
  onboarded: boolean;
  // "Having performance issues?" tip: permanently dismissed, and when last shown
  // (a cooldown so a session-dismiss doesn't nag on the next launch).
  perfTipSuppressed: boolean;
  perfTipLastShown: number;
  setModelId: (modelId: string | null) => void;
  setVoice: (voiceId: string) => void;
  setLang: (lang: string) => void;
  setSpeed: (speed: number) => void;
  setSteps: (steps: number) => void;
  setOnboarded: (onboarded: boolean) => void;
  suppressPerfTip: () => void;
  markPerfTipShown: () => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      modelId: null,
      voiceId: DEFAULT_VOICE,
      lang: 'en',
      speed: 1.05,
      steps: 5,
      onboarded: false,
      perfTipSuppressed: false,
      perfTipLastShown: 0,
      setModelId: (modelId) => set({ modelId }),
      setVoice: (voiceId) => set({ voiceId }),
      setLang: (lang) => set({ lang }),
      setSpeed: (speed) => set({ speed }),
      setSteps: (steps) => set({ steps }),
      setOnboarded: (onboarded) => set({ onboarded }),
      suppressPerfTip: () => set({ perfTipSuppressed: true }),
      markPerfTipShown: () => set({ perfTipLastShown: Date.now() }),
    }),
    { name: 'settings', storage: createJSONStorage(() => fileStorage) },
  ),
);

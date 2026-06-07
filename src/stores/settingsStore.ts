import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_VOICE } from '../supertonic';
import { fileStorage } from './fileStorage';

type SettingsState = {
  /** Active model build id (e.g. 'supertonic-2'); null until the user picks one. */
  modelId: string | null;
  /** Voice id, e.g. 'M1' / 'F2'. */
  voiceId: string;
  /** Global default narration language (a SupportedLanguage code, e.g. 'en').
   *  A document may override this; absent override falls back here. */
  lang: string;
  /** Speech speed factor (~0.9–1.5). */
  speed: number;
  /** Denoising/inference steps (quality vs. latency). */
  steps: number;
  setModelId: (modelId: string | null) => void;
  setVoice: (voiceId: string) => void;
  setLang: (lang: string) => void;
  setSpeed: (speed: number) => void;
  setSteps: (steps: number) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      modelId: null,
      voiceId: DEFAULT_VOICE,
      lang: 'en',
      speed: 1.05,
      steps: 16,
      setModelId: (modelId) => set({ modelId }),
      setVoice: (voiceId) => set({ voiceId }),
      setLang: (lang) => set({ lang }),
      setSpeed: (speed) => set({ speed }),
      setSteps: (steps) => set({ steps }),
    }),
    { name: 'settings', storage: createJSONStorage(() => fileStorage) },
  ),
);

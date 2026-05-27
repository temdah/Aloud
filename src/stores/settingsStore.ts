import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_VOICE } from '../supertonic';
import { fileStorage } from './fileStorage';

type SettingsState = {
  /** Voice id, e.g. 'M1' / 'F2'. */
  voiceId: string;
  /** Speech speed factor (~0.9–1.5). */
  speed: number;
  /** Denoising/inference steps (quality vs. latency). */
  steps: number;
  setVoice: (voiceId: string) => void;
  setSpeed: (speed: number) => void;
  setSteps: (steps: number) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      voiceId: DEFAULT_VOICE,
      speed: 1.05,
      steps: 16,
      setVoice: (voiceId) => set({ voiceId }),
      setSpeed: (speed) => set({ speed }),
      setSteps: (steps) => set({ steps }),
    }),
    { name: 'settings', storage: createJSONStorage(() => fileStorage) },
  ),
);

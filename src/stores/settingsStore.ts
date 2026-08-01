import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_QUALITY, DEFAULT_VOICE, qualityProfile, type Quality } from '../supertonic';
import { fileStorage } from './fileStorage';

// Global narration settings (model, voice, language, speed, steps), persisted.

type SettingsState = {
  modelId: string | null;
  voiceId: string;
  // A document may override this; absent an override, narration falls back here.
  lang: string;
  speed: number;
  // Per-clip synthesis steps. Follows the quality preset, overridable via Advanced.
  steps: number;
  // Playback quality preset — sets the chunk unit length and steps together.
  quality: Quality;
  // Keep the voice engine loaded for instant starts (uses ~300 MB); off releases
  // it when idle to save memory on low-RAM devices.
  keepEngineWarm: boolean;
  // First-run wizard seen (model downloaded before the first play prompt).
  onboarded: boolean;
  // Timestamp the user explicitly accepted the Terms (0 = not yet).
  termsAcceptedAt: number;
  // "Having performance issues?" tip: permanently dismissed, and when last shown
  // (a cooldown so a session-dismiss doesn't nag on the next launch).
  perfTipSuppressed: boolean;
  perfTipLastShown: number;
  setModelId: (modelId: string | null) => void;
  setVoice: (voiceId: string) => void;
  setLang: (lang: string) => void;
  setSpeed: (speed: number) => void;
  setSteps: (steps: number) => void;
  setQuality: (quality: Quality) => void;
  setKeepEngineWarm: (keepEngineWarm: boolean) => void;
  setOnboarded: (onboarded: boolean) => void;
  acceptTerms: () => void;
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
      quality: DEFAULT_QUALITY,
      keepEngineWarm: true,
      onboarded: false,
      termsAcceptedAt: 0,
      perfTipSuppressed: false,
      perfTipLastShown: 0,
      setModelId: (modelId) => set({ modelId }),
      setVoice: (voiceId) => set({ voiceId }),
      setLang: (lang) => set({ lang }),
      setSpeed: (speed) => set({ speed }),
      setSteps: (steps) => set({ steps }),
      // Picking a preset also sets its steps; Advanced can then override steps alone.
      setQuality: (quality) => set({ quality, steps: qualityProfile(quality).steps }),
      setKeepEngineWarm: (keepEngineWarm) => set({ keepEngineWarm }),
      setOnboarded: (onboarded) => set({ onboarded }),
      acceptTerms: () => set({ termsAcceptedAt: Date.now() }),
      suppressPerfTip: () => set({ perfTipSuppressed: true }),
      markPerfTipShown: () => set({ perfTipLastShown: Date.now() }),
    }),
    { name: 'settings', storage: createJSONStorage(() => fileStorage) },
  ),
);

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_NARRATION_TONE, DEFAULT_QUALITY, DEFAULT_VOICE, normalizeNarrationTone, normalizeSynthesisSteps, qualityProfile } from '../supertonic';
import { fileStorage } from './fileStorage';
import type { SettingsState } from './settingsStoreTypes';

// Global narration settings (model, voice, language, speed, steps), persisted.

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      modelId: null,
      voiceId: DEFAULT_VOICE,
      lang: 'en',
      speed: 1.05,
      steps: qualityProfile(DEFAULT_QUALITY).steps,
      quality: DEFAULT_QUALITY,
      tone: DEFAULT_NARRATION_TONE,
      keepEngineWarm: true,
      onboarded: false,
      termsAcceptedAt: 0,
      perfTipSuppressed: false,
      perfTipLastShown: 0,
      setModelId: (modelId) => set({ modelId }),
      setVoice: (voiceId) => set({ voiceId }),
      setLang: (lang) => set({ lang }),
      setSpeed: (speed) => set({ speed }),
      setSteps: (steps) => set({ steps: normalizeSynthesisSteps(steps) }),
      // Picking a preset also sets its steps; Advanced can then override steps alone.
      setQuality: (quality) => set({ quality, steps: qualityProfile(quality).steps }),
      setTone: (tone) => set({ tone: normalizeNarrationTone(tone) }),
      setKeepEngineWarm: (keepEngineWarm) => set({ keepEngineWarm }),
      setOnboarded: (onboarded) => set({ onboarded }),
      acceptTerms: () => set({ termsAcceptedAt: Date.now() }),
      suppressPerfTip: () => set({ perfTipSuppressed: true }),
      markPerfTipShown: () => set({ perfTipLastShown: Date.now() }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => fileStorage),
      merge: (persisted, current) => {
        const saved = persisted as Partial<SettingsState>;
        return {
          ...current,
          ...saved,
          steps: normalizeSynthesisSteps(saved.steps ?? current.steps),
          tone: normalizeNarrationTone(saved.tone),
        };
      },
    },
  ),
);

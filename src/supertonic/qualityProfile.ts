// Playback quality presets: one dial the user picks that sets both the chunk
// unit length (latency vs. prosody) and the synthesis steps (per-clip quality).
// Balanced == the historical default (unit 300, steps 5), so existing caches are
// undisturbed until a user deliberately changes the preset.

export const DEFAULT_QUALITY: Quality = 'balanced';
export const MIN_SYNTHESIS_STEPS = 5;

const PROFILES: Record<Quality, QualityProfile> = {
  fast: { unitLen: 120, steps: 5 }, // small self-contained units → stays ahead on slow phones (4 steps sounds bad)
  balanced: { unitLen: 300, steps: 6 },
  quality: { unitLen: 400, steps: 8 }, // larger units + more steps → smoothest, needs a capable phone
};

export function qualityProfile(q: Quality): QualityProfile {
  return PROFILES[q] ?? PROFILES.balanced;
}

export function normalizeSynthesisSteps(value: number): number {
  const rounded = Number.isFinite(value) ? Math.round(value) : MIN_SYNTHESIS_STEPS;
  return Math.max(MIN_SYNTHESIS_STEPS, rounded);
}

export const QUALITY_LABELS: Record<Quality, { title: string; subtitle: string }> = {
  fast: { title: 'Faster', subtitle: 'Starts quickly · best for older phones' },
  balanced: { title: 'Balanced', subtitle: 'A good default for most phones' },
  quality: { title: 'Higher quality', subtitle: 'Smoothest and most natural · best on newer phones' },
};
import type { Quality, QualityProfile } from './qualityProfileTypes';

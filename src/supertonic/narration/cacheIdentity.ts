import type { SentenceAnchor } from '../../types';
import { stableHash } from '../../utils';
import { normalizeSynthesisSteps } from '../qualityProfile';
import { normalizeNarrationTone } from './tonePlanner';
import type { NarrationSettings } from './narrationTypes';

// Bump when synthesis changes the audio produced for otherwise-identical input.
// v3 removed speed from synthesis; v4 moved output from WAV to AAC; v5 adds
// punctuation-aware cadence cues and deterministic trailing pauses; v7 shortens
// those pauses after device listening tests.
const SYNTH_VERSION = 7;

export function settingsHash(settings: NarrationSettings): string {
  return stableHash(
    `v${SYNTH_VERSION}|${settings.modelId}|${settings.voiceId}|${normalizeSynthesisSteps(settings.steps)}|${settings.lang}|${settings.quality}|${normalizeNarrationTone(settings.tone)}`,
  );
}

// Sentence audio is independent of canonical chunk grouping. Keep quality out
// of this hash because its unit length only controls grouping; synthesis steps
// remain included and still separate genuinely different audio.
export function sentenceSettingsHash(settings: NarrationSettings): string {
  return stableHash(
    `sentence-v4|${settings.modelId}|${settings.voiceId}|${normalizeSynthesisSteps(settings.steps)}|${settings.lang}|${normalizeNarrationTone(settings.tone)}`,
  );
}

export function sentenceCacheBaseName(anchor: Pick<SentenceAnchor, 'id'>, settings: NarrationSettings): string {
  return `sentence-${anchor.id}-${sentenceSettingsHash(settings)}`;
}

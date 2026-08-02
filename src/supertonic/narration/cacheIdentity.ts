import type { SentenceAnchor } from '../../types';
import { stableHash } from '../../utils/hash';
import type { NarrationSettings } from './narrationTypes';

// Bump when synthesis changes the audio produced for otherwise-identical input.
// v3 removed speed from synthesis; v4 moved output from WAV to AAC.
const SYNTH_VERSION = 4;

export function settingsHash(settings: NarrationSettings): string {
  return stableHash(
    `v${SYNTH_VERSION}|${settings.modelId}|${settings.voiceId}|${settings.steps}|${settings.lang}|${settings.quality}`,
  );
}

// Sentence audio is independent of canonical chunk grouping. Keep quality out
// of this hash because its unit length only controls grouping; synthesis steps
// remain included and still separate genuinely different audio.
export function sentenceSettingsHash(settings: NarrationSettings): string {
  return stableHash(
    `sentence-v1|${settings.modelId}|${settings.voiceId}|${settings.steps}|${settings.lang}`,
  );
}

export function sentenceCacheBaseName(anchor: Pick<SentenceAnchor, 'id'>, settings: NarrationSettings): string {
  return `sentence-${anchor.id}-${sentenceSettingsHash(settings)}`;
}

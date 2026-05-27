import { AVAILABLE_VOICES } from '../../supertonic';
import type { Voice } from '../../types';

// Real selectable voices derived from the model's voice IDs (F1–F5, M1–M5).
// No invented names/descriptions — labels are derived from the id.
export const VOICES: Voice[] = AVAILABLE_VOICES.map((id) => ({
  id,
  gender: id.startsWith('F') ? 'f' : 'm',
  label: `${id.startsWith('F') ? 'Female' : 'Male'} ${id.slice(1)}`,
}));

export function voiceLabel(id: string): string {
  return VOICES.find((v) => v.id === id)?.label ?? id;
}

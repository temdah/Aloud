import type { NarrationTone, ResolvedNarrationTone } from '../../types';
import type { TonePlan } from './tonePlannerTypes';

export const DEFAULT_NARRATION_TONE: NarrationTone = 'adaptive';

export const NARRATION_TONE_LABELS: Record<NarrationTone, { title: string; subtitle: string }> = {
  adaptive: { title: 'Adaptive', subtitle: 'Matches stories and keeps academic text neutral' },
  neutral: { title: 'Neutral', subtitle: 'Steady delivery for papers and factual reading' },
  expressive: { title: 'Expressive', subtitle: 'More varied pacing for general narration' },
  happy: { title: 'Happy', subtitle: 'Lighter and more energetic pacing' },
  sad: { title: 'Sad', subtitle: 'Slower delivery with longer pauses' },
  scared: { title: 'Scared', subtitle: 'Tense pacing with dramatic pauses' },
};

const TONE_VALUES: NarrationTone[] = ['adaptive', 'neutral', 'expressive', 'happy', 'sad', 'scared'];
const ACADEMIC_TERMS = new Set([
  'abstract', 'analysis', 'conclusion', 'data', 'discussion', 'doi', 'experiment', 'figure', 'findings',
  'hypothesis', 'literature', 'method', 'methodology', 'references', 'results', 'study', 'table', 'theorem',
]);
const HAPPY_TERMS = new Set(['celebrate', 'cheerful', 'delighted', 'excited', 'glad', 'happy', 'joy', 'laughed', 'smiled', 'sunshine', 'wonderful']);
const SAD_TERMS = new Set(['alone', 'cried', 'death', 'died', 'grief', 'lonely', 'mourned', 'sad', 'sorrow', 'tears', 'wept']);
const SCARED_TERMS = new Set(['afraid', 'blood', 'danger', 'darkness', 'fear', 'footsteps', 'monster', 'nightmare', 'scream', 'shadow', 'terror', 'trembling']);

const TONE_PROFILE: Record<ResolvedNarrationTone, Pick<TonePlan, 'synthesisSpeed' | 'pauseScale'>> = {
  neutral: { synthesisSpeed: 1, pauseScale: 0.95 },
  expressive: { synthesisSpeed: 1, pauseScale: 1 },
  happy: { synthesisSpeed: 1.06, pauseScale: 0.88 },
  sad: { synthesisSpeed: 0.92, pauseScale: 1.25 },
  scared: { synthesisSpeed: 1.08, pauseScale: 1.15 },
};

export function normalizeNarrationTone(value: unknown): NarrationTone {
  return TONE_VALUES.includes(value as NarrationTone) ? value as NarrationTone : DEFAULT_NARRATION_TONE;
}

function words(text: string): string[] {
  return text.toLowerCase().match(/\p{L}+/gu) ?? [];
}

export function isAcademicDocument(documentText: string): boolean {
  const sample = documentText.slice(0, 16_000);
  const matchedTerms = new Set<string>();
  for (const word of words(sample)) {
    if (ACADEMIC_TERMS.has(word)) matchedTerms.add(word);
    if (matchedTerms.size >= 4) return true;
  }
  const citations = (sample.match(/\[[0-9,;\s-]+]|\bet\s+al\./gi) ?? []).length;
  return matchedTerms.size + Math.min(3, citations) >= 5;
}

function inferEmotionalTone(text: string): ResolvedNarrationTone {
  let happy = 0;
  let sad = 0;
  let scared = 0;
  for (const word of words(text)) {
    if (HAPPY_TERMS.has(word)) happy++;
    if (SAD_TERMS.has(word)) sad++;
    if (SCARED_TERMS.has(word)) scared++;
  }
  const strongest = Math.max(happy, sad, scared);
  if (strongest > 0) {
    if (scared === strongest) return 'scared';
    if (sad === strongest) return 'sad';
    return 'happy';
  }
  return /[!?]|["“”].+["“”]/u.test(text) ? 'expressive' : 'neutral';
}

export function planNarrationTone(
  documentText: string,
  unitText: string,
  requested: NarrationTone,
  knownAcademicDocument = isAcademicDocument(documentText),
): TonePlan {
  const normalized = normalizeNarrationTone(requested);
  const academicDocument = normalized === 'adaptive' && knownAcademicDocument;
  const resolved: ResolvedNarrationTone = normalized === 'adaptive'
    ? academicDocument ? 'neutral' : inferEmotionalTone(unitText)
    : normalized;
  return { requested: normalized, resolved, academicDocument, ...TONE_PROFILE[resolved] };
}

export type NarrationTone = 'adaptive' | 'neutral' | 'expressive' | 'happy' | 'sad' | 'scared';
export type ResolvedNarrationTone = Exclude<NarrationTone, 'adaptive'>;

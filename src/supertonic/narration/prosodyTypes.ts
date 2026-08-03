export type ProsodyBoundary =
  | 'none'
  | 'continuation'
  | 'comma'
  | 'clause'
  | 'sentence'
  | 'question'
  | 'exclamation'
  | 'ellipsis'
  | 'paragraph';

export type ProsodyPlan = {
  synthesisText: string;
  trailingPauseMs: number;
  boundary: ProsodyBoundary;
};

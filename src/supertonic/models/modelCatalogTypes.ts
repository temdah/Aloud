import type { SupportedLanguage } from '../text/languageTypes';

export type ModelFileMinimums = {
  durationPredictor: number;
  textEncoder: number;
  vectorEstimator: number;
  vocoder: number;
  config: number;
  indexer: number;
  voice: number;
};

export type ModelInfo = {
  id: string;
  label: string;
  repo: string;
  approxMb: number;
  tagline: string;
  overview: string;
  languages: string;
  langCodes: SupportedLanguage[];
  minBytes: ModelFileMinimums;
};

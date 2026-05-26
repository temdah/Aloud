// Types for text processing / tokenization.

/** Tokenized text ready to feed the models. */
export type TokenizedText = {
  /** Per-utterance token id rows, padded to the longest row. */
  textIds: number[][];
  /** Attention mask shaped [batch][1][length]. */
  textMask: number[][][];
};

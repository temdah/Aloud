// Types for text processing / tokenization.

export type TokenizedText = {
  textIds: number[][]; // token id rows, padded to the longest
  textMask: number[][][]; // [batch][1][length]
};

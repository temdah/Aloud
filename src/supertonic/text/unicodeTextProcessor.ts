import { isLanguageSupported } from './languages';
import type { TokenizedText } from './textTypes';

// Normalizes text and converts it to model token ids via the Supertonic unicode
// indexer. Pure JS, character-level (no phonemizer). Ported from web/helper.js.
export class UnicodeTextProcessor {
  private readonly indexer: number[];

  constructor(indexer: number[]) {
    this.indexer = indexer;
  }

  tokenize(textList: string[], langList: string[]): TokenizedText {
    const processed = textList.map((t, i) => this.preprocess(t, langList[i]));
    const lengths = processed.map((t) => t.length);
    const maxLen = Math.max(...lengths);

    const textIds = processed.map((text) => {
      const row = new Array<number>(maxLen).fill(0);
      for (let j = 0; j < text.length; j++) {
        const codePoint = text.codePointAt(j)!;
        row[j] = codePoint < this.indexer.length ? this.indexer[codePoint] : -1;
      }
      return row;
    });

    return { textIds, textMask: lengthsToMask(lengths, maxLen) };
  }

  private preprocess(text: string, lang: string): string {
    text = text.normalize('NFKD');

    const emojiPattern =
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]+/gu;
    text = text.replace(emojiPattern, '');

    const symbolReplacements: Record<string, string> = {
      '–': '-', '‑': '-', '—': '-', '_': ' ',
      '“': '"', '”': '"', '‘': "'", '’': "'",
      '´': "'", '`': "'", '[': ' ', ']': ' ', '|': ' ',
      '/': ' ', '#': ' ', '→': ' ', '←': ' ',
    };
    for (const [from, to] of Object.entries(symbolReplacements)) {
      text = text.replaceAll(from, to);
    }

    text = text.replace(/[♥☆♡©\\]/g, '');

    const phraseReplacements: Record<string, string> = {
      '@': ' at ', 'e.g.,': 'for example, ', 'i.e.,': 'that is, ',
    };
    for (const [from, to] of Object.entries(phraseReplacements)) {
      text = text.replaceAll(from, to);
    }

    text = text
      .replace(/ ,/g, ',')
      .replace(/ \./g, '.')
      .replace(/ !/g, '!')
      .replace(/ \?/g, '?')
      .replace(/ ;/g, ';')
      .replace(/ :/g, ':')
      .replace(/ '/g, "'");

    while (text.includes('""')) text = text.replace('""', '"');
    while (text.includes("''")) text = text.replace("''", "'");
    while (text.includes('``')) text = text.replace('``', '`');

    // A blank line with no terminal punctuation before it (e.g. a heading above
    // its body) gets a period so the model pauses instead of running on.
    text = text.replace(/([^\s.!?:;,'")\]])\s*\n\s*\n/g, '$1. ');
    text = text.replace(/[\r\n]+/g, ' ');

    text = text.replace(/\s+/g, ' ').trim();

    if (!/[.!?;:,'")\]}…。」』】〉》›»]$/.test(text)) {
      text += '.';
    }

    if (!isLanguageSupported(lang)) {
      throw new Error(`Unsupported language: ${lang}`);
    }

    return `<${lang}>${text}</${lang}>`;
  }
}

export function lengthsToMask(lengths: number[], maxLen: number): number[][][] {
  return lengths.map((len) => {
    const row = new Array<number>(maxLen).fill(0.0);
    for (let j = 0; j < Math.min(len, maxLen); j++) row[j] = 1.0;
    return [row];
  });
}

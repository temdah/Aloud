// Languages supported by the Supertonic multilingual model.

export const AVAILABLE_LANGUAGES = [
  'en', 'ko', 'ja', 'ar', 'bg', 'cs', 'da', 'de', 'el', 'es', 'et', 'fi', 'fr',
  'hi', 'hr', 'hu', 'id', 'it', 'lt', 'lv', 'nl', 'pl', 'pt', 'ro', 'ru', 'sk',
  'sl', 'sv', 'tr', 'uk', 'vi', 'na',
] as const;

export type SupportedLanguage = (typeof AVAILABLE_LANGUAGES)[number];

export function isLanguageSupported(lang: string): lang is SupportedLanguage {
  return (AVAILABLE_LANGUAGES as readonly string[]).includes(lang);
}

// Human-readable names for the language picker (full-audiobook config).
export const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English', ko: 'Korean', ja: 'Japanese', ar: 'Arabic', bg: 'Bulgarian',
  cs: 'Czech', da: 'Danish', de: 'German', el: 'Greek', es: 'Spanish',
  et: 'Estonian', fi: 'Finnish', fr: 'French', hi: 'Hindi', hr: 'Croatian',
  hu: 'Hungarian', id: 'Indonesian', it: 'Italian', lt: 'Lithuanian',
  lv: 'Latvian', nl: 'Dutch', pl: 'Polish', pt: 'Portuguese', ro: 'Romanian',
  ru: 'Russian', sk: 'Slovak', sl: 'Slovenian', sv: 'Swedish', tr: 'Turkish',
  uk: 'Ukrainian', vi: 'Vietnamese', na: 'Other',
};

export const languageLabel = (code: string): string => LANGUAGE_LABELS[code] ?? code.toUpperCase();

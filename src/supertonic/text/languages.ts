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

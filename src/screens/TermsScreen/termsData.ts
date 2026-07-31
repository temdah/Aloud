// Mirrors TERMS.md so the terms are readable in-app. Keep the two in sync.

export type TermsSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  footer?: string;
};

export const TERMS_UPDATED = '2026-07-31';

export const TERMS_INTRO =
  'Aloud ("the app") is a personal, on-device document reader that speaks your documents aloud using an offline text-to-speech voice. The app is published by Temirlan Dahle, operating as monkeybusiness ("we"). By installing or using the app, you agree to these Terms. If you do not agree, do not use the app.';

export const TERMS_SECTIONS: TermsSection[] = [
  {
    title: '1. Personal, non-commercial use only',
    paragraphs: ['The app is licensed to you for personal, non-commercial use. You may not:'],
    bullets: [
      'sell, rent, sublicense, or otherwise commercialize the app or any part of it;',
      'redistribute the app or repackage it as your own product;',
      'use the app, or its source code, on behalf of a business or organization for commercial purposes.',
    ],
    footer:
      'The source code is provided under the PolyForm Noncommercial License 1.0.0 (see LICENSE). These Terms govern your use of the distributed app.',
  },
  {
    title: '2. The voice models',
    paragraphs: [
      'Voices are generated on your device by third-party AI models (Supertonic), downloaded on first use under a Responsible-AI license (OpenRAIL-M). You agree not to use the app or its voices to:',
    ],
    bullets: [
      'impersonate a real person or create deceptive or misleading audio;',
      'produce unlawful, harmful, harassing, defamatory, or infringing content;',
      "do anything the underlying model's license prohibits.",
    ],
  },
  {
    title: '3. Your documents',
    paragraphs: [
      'You are solely responsible for the documents you import and for having the right to use them. Do not import content you are not permitted to reproduce or listen to. Your documents and generated audio stay on your device — the app works fully offline and does not upload your content.',
    ],
  },
  {
    title: '4. Third-party components',
    paragraphs: [
      'The app includes open-source components under their own licenses; see Open-source licenses in Settings. Nothing in these Terms limits your rights under those licenses.',
    ],
  },
  {
    title: '5. No warranty',
    paragraphs: [
      'The app is provided "as is", without warranty of any kind. Voice output is machine-generated and may contain mistakes; do not rely on it where accuracy is critical.',
    ],
  },
  {
    title: '6. Limitation of liability',
    paragraphs: [
      'To the maximum extent permitted by law, we will not be liable for any indirect, incidental, special, or consequential damages, or any loss of data, arising out of or related to your use of the app.',
    ],
  },
  {
    title: '7. Changes',
    paragraphs: [
      'These Terms may be updated in future versions of the app. Continued use after an update means you accept the revised Terms.',
    ],
  },
  {
    title: '8. Governing law',
    paragraphs: [
      'These Terms are governed by the laws of [YOUR COUNTRY/STATE — set this], without regard to conflict-of-law rules, and any dispute relating to the app or these Terms is subject to the exclusive jurisdiction of the courts located there.',
    ],
  },
  {
    title: '9. Contact',
    paragraphs: ['Questions about these Terms: temirdahle@gmail.com'],
  },
];

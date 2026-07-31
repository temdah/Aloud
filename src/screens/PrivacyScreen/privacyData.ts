// Mirrors PRIVACY.md so the policy is readable in-app. Keep the two in sync.

export type PrivacySection = { title: string; paragraphs: string[] };

export const PRIVACY_UPDATED = '2026-07-31';

export const PRIVACY_INTRO =
  'Aloud ("the app") is built to work entirely on your device. It is published by Temirlan Dahle, operating as monkeybusiness ("we"). We do not collect, store, or transmit your personal information.';

export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    title: '1. What we collect',
    paragraphs: [
      'Nothing. Aloud has no account, no analytics, and no tracking. We do not collect personal data about you or how you use the app.',
    ],
  },
  {
    title: '2. Your documents and audio',
    paragraphs: [
      'Documents you import and the audio generated from them stay on your device. They are never uploaded to us or to any third party. The app works fully offline.',
    ],
  },
  {
    title: '3. Network use',
    paragraphs: [
      'The only time Aloud uses the network is to download the on-device voice model files on first use (and to receive app updates through your app store or install source). These requests download data to your device — they never send your documents or personal information anywhere.',
    ],
  },
  {
    title: '4. Third parties',
    paragraphs: [
      'Aloud does not share data with third parties and includes no third-party analytics, advertising, or tracking SDKs.',
    ],
  },
  {
    title: '5. Permissions',
    paragraphs: [
      'Aloud requests notification permission to show playback controls, and access only to the files you explicitly choose to import. It does not scan your device or read files you have not selected.',
    ],
  },
  {
    title: '6. Children',
    paragraphs: ['Aloud is not directed at children and does not knowingly collect data from anyone, of any age.'],
  },
  {
    title: '7. Changes',
    paragraphs: [
      'This policy may be updated in future versions of the app. The current version is always available in the app under Settings → About.',
    ],
  },
  {
    title: '8. Contact',
    paragraphs: ['Questions about this policy: temirdahle@gmail.com'],
  },
];

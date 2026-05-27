export type LicenseEntry = {
  name: string;
  license: string;
  note?: string;
};

export type LicenseSection = {
  title: string;
  entries: LicenseEntry[];
};

// Third-party components shipped in the app and their licenses. Keep accurate —
// this screen is the app's open-source attribution / compliance surface.
export const LICENSE_SECTIONS: LicenseSection[] = [
  {
    title: 'Voice model',
    entries: [
      { name: 'Supertonic 2', license: 'OpenRAIL-M License', note: '© 2026 Supertone Inc. — commercial use permitted under responsible-AI terms' },
      { name: 'Supertonic sample code', license: 'MIT License', note: '© Supertone Inc.' },
    ],
  },
  {
    title: 'PDF text extraction',
    entries: [
      { name: 'PDF.js (pdfjs-dist)', license: 'Apache License 2.0', note: '© Mozilla Foundation' },
    ],
  },
  {
    title: 'Fonts',
    entries: [
      { name: 'Newsreader', license: 'SIL Open Font License 1.1' },
      { name: 'DM Sans', license: 'SIL Open Font License 1.1' },
      { name: 'JetBrains Mono', license: 'SIL Open Font License 1.1' },
    ],
  },
  {
    title: 'Libraries',
    entries: [
      { name: 'React, React Native', license: 'MIT License' },
      { name: 'Expo SDK & modules', license: 'MIT License' },
      { name: 'ONNX Runtime (onnxruntime-react-native)', license: 'MIT License' },
      { name: 'React Navigation', license: 'MIT License' },
      { name: 'react-native-screens', license: 'MIT License' },
      { name: 'react-native-safe-area-context', license: 'MIT License' },
      { name: 'react-native-webview', license: 'MIT License' },
      { name: 'react-native-svg', license: 'MIT License' },
      { name: 'zustand', license: 'MIT License' },
    ],
  },
];

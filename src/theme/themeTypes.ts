import type { TextStyle } from 'react-native';

// Theme types: semantic colour palette, type tokens, and the theme context shape.

export type Mode = 'light' | 'dark';

export type ElevationLevel = 0 | 1 | 2 | 3 | 4;

export type CoverHue = {
  bg: string;
  stripe: string;
  accent: string;
};

export type Palette = {
  background: string; surface: string; surfaceAlt: string; surfaceSunk: string;
  text: string; textMuted: string; textDim: string;
  primary: string; primarySoft: string; onPrimary: string;
  border: string; borderStrong: string;
  highlight: string; highlightInk: string;
  danger: string; success: string;
  shadow: string; shadowStrong: string;
};

export type TypeToken = Pick<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing'>;

export type TypeName =
  | 'display' | 'titleLarge' | 'titleSerif' | 'title' | 'body' | 'bodyMedium'
  | 'bodySmall' | 'label' | 'caption' | 'overline' | 'mono' | 'reader';

export type ThemeContextValue = {
  palette: Palette;
  mode: Mode;
  setMode: (mode: Mode) => void;
  toggleMode: () => void;
};

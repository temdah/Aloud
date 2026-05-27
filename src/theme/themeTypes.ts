import type { TextStyle } from 'react-native';

export type Mode = 'light' | 'dark';

/** Semantic color tokens. Mode-dependent (light/dark). */
export type Palette = {
  background: string; surface: string; surfaceAlt: string; surfaceSunk: string;
  text: string; textMuted: string; textDim: string;
  primary: string; primarySoft: string; onPrimary: string;
  border: string; borderStrong: string;
  highlight: string; highlightInk: string;
  danger: string; success: string;
  shadow: string; shadowStrong: string;
};

/** A precomputed React Native text style token (font, size, spacing). */
export type TypeToken = Pick<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing'>;

export type TypeName =
  | 'display' | 'titleLarge' | 'titleSerif' | 'title' | 'body' | 'bodyMedium'
  | 'bodySmall' | 'label' | 'caption' | 'overline' | 'mono' | 'reader';

/** Value provided by the theme context. */
export type ThemeContextValue = {
  palette: Palette;
  mode: Mode;
  setMode: (mode: Mode) => void;
  toggleMode: () => void;
};

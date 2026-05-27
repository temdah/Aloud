import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold } from '@expo-google-fonts/dm-sans';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { Newsreader_400Regular, Newsreader_500Medium } from '@expo-google-fonts/newsreader';
import type { TextStyle } from 'react-native';
import type { TypeName, TypeToken } from './themeTypes';

// Pass to `useFonts` at app start. With custom fonts, weight is encoded in the
// family name (e.g. DMSans_600SemiBold), not via fontWeight.
export const fontsToLoad = {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  Newsreader_400Regular,
  Newsreader_500Medium,
  JetBrainsMono_500Medium,
};

// Type scale from the design. letterSpacing is the design's em value × size (dp).
export const TYPE: Record<TypeName, TypeToken> = {
  display: { fontFamily: 'Newsreader_500Medium', fontSize: 32, lineHeight: 38, letterSpacing: -0.32 },
  titleLarge: { fontFamily: 'Newsreader_500Medium', fontSize: 22, lineHeight: 28, letterSpacing: -0.11 },
  titleSerif: { fontFamily: 'Newsreader_500Medium', fontSize: 18, lineHeight: 24, letterSpacing: 0 },
  title: { fontFamily: 'DMSans_600SemiBold', fontSize: 17, lineHeight: 22, letterSpacing: -0.085 },
  body: { fontFamily: 'DMSans_400Regular', fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  bodyMedium: { fontFamily: 'DMSans_500Medium', fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  bodySmall: { fontFamily: 'DMSans_400Regular', fontSize: 13, lineHeight: 18, letterSpacing: 0 },
  label: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, lineHeight: 16, letterSpacing: 0.13 },
  caption: { fontFamily: 'DMSans_500Medium', fontSize: 12, lineHeight: 15, letterSpacing: 0.24 },
  overline: { fontFamily: 'DMSans_600SemiBold', fontSize: 11, lineHeight: 14, letterSpacing: 1.1 },
  mono: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 12, lineHeight: 16, letterSpacing: 0 },
  reader: { fontFamily: 'Newsreader_400Regular', fontSize: 17, lineHeight: 28, letterSpacing: 0 },
};

// Builds a text style from a type token + color. RN equivalent of the design's `ty()`.
export function ty(token: TypeToken, color: string): TextStyle {
  return { ...token, color };
}

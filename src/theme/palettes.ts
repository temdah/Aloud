import type { Mode, Palette } from './themeTypes';

// Warm "paper" palette from the design. Single source of truth for color.
export const LIGHT: Palette = {
  background: '#faf8f4',
  surface: '#ffffff',
  surfaceAlt: '#f3efe8',
  surfaceSunk: '#ede8df',
  text: '#1a1814',
  textMuted: '#6b655c',
  textDim: '#9a9389',
  primary: '#b8703a',
  primarySoft: '#f6e4d1',
  onPrimary: '#ffffff',
  border: '#e8e2d8',
  borderStrong: '#d6cfc0',
  highlight: '#fde9b9',
  highlightInk: '#6b4f12',
  danger: '#b8463a',
  success: '#5a7d4a',
  shadow: 'rgba(40, 30, 15, 0.08)',
  shadowStrong: 'rgba(40, 30, 15, 0.18)',
};

export const DARK: Palette = {
  background: '#15140f',
  surface: '#1f1d18',
  surfaceAlt: '#2a2823',
  surfaceSunk: '#100f0b',
  text: '#f0ede6',
  textMuted: '#a39d92',
  textDim: '#6b655c',
  primary: '#d49156',
  primarySoft: '#3b2a18',
  onPrimary: '#15140f',
  border: '#2f2c26',
  borderStrong: '#403c34',
  highlight: '#4a3e1d',
  highlightInk: '#fde9b9',
  danger: '#d4675a',
  success: '#85a872',
  shadow: 'rgba(0, 0, 0, 0.35)',
  shadowStrong: 'rgba(0, 0, 0, 0.55)',
};

export function paletteFor(mode: Mode): Palette {
  return mode === 'dark' ? DARK : LIGHT;
}

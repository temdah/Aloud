// Library cover palette, shared by the cover thumbnail and (via the native
// notification patch) the lock-screen accent — so a book looks the same in both.
// The index is stored per-document; absent an override it's derived from the hash.
export type CoverHue = {
  bg: string;
  stripe: string;
  accent: string; // tints the media notification
};

export const COVER_PALETTE: CoverHue[] = [
  { bg: '#d6c4a8', stripe: '#a8896b', accent: '#8a6d4b' },
  { bg: '#c2b8a3', stripe: '#7d7361', accent: '#5f5746' },
  { bg: '#a8b0a0', stripe: '#5e6657', accent: '#46503f' },
  { bg: '#c9a89a', stripe: '#8a665a', accent: '#6e4a3e' },
  { bg: '#b8a8c2', stripe: '#6e607a', accent: '#544861' },
];

export const COVER_COUNT = COVER_PALETTE.length;

// Wraps any index (incl. negative / out-of-range) into a palette entry.
export function coverHue(idx: number): CoverHue {
  return COVER_PALETTE[((idx % COVER_COUNT) + COVER_COUNT) % COVER_COUNT];
}

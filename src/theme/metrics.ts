import type { ViewStyle } from 'react-native';

// Spacing, radius, and elevation design tokens.

export const SPACE = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32, 8: 40, 9: 48, 10: 64 } as const;

export const RADIUS = { sm: 6, md: 10, lg: 16, xl: 24, pill: 999 } as const;

export type ElevationLevel = 0 | 1 | 2 | 3 | 4;

const OFFSET_Y = [0, 1, 2, 8, 24];
const OPACITY = [0, 0.06, 0.1, 0.14, 0.2];
const RADIUS_PX = [0, 2, 6, 24, 48];

export function elevation(level: ElevationLevel): ViewStyle {
  if (level === 0) return {};
  return {
    shadowColor: '#281e0f', // warm paper shadow
    shadowOffset: { width: 0, height: OFFSET_Y[level] },
    shadowOpacity: OPACITY[level],
    shadowRadius: RADIUS_PX[level],
    elevation: level * 2,
  };
}

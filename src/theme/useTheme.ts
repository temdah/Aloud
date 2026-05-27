import { useContext } from 'react';
import { ThemeContext } from './ThemeProvider';
import type { ThemeContextValue } from './themeTypes';

// Components read the active palette + mode here instead of taking `palette`
// as a prop, so design tokens stay centralised.
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

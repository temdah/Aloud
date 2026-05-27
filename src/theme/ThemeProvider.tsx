import { createContext, useCallback, useMemo, useState, type ReactNode } from 'react';
import { paletteFor } from './palettes';
import type { Mode, ThemeContextValue } from './themeTypes';

export const ThemeContext = createContext<ThemeContextValue>({
  palette: paletteFor('light'),
  mode: 'light',
  setMode: () => {},
  toggleMode: () => {},
});

type ThemeProviderProps = {
  children: ReactNode;
  initialMode?: Mode;
};

export function ThemeProvider({ children, initialMode = 'light' }: ThemeProviderProps) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const toggleMode = useCallback(() => setMode((m) => (m === 'light' ? 'dark' : 'light')), []);

  const value = useMemo<ThemeContextValue>(
    () => ({ palette: paletteFor(mode), mode, setMode, toggleMode }),
    [mode, toggleMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

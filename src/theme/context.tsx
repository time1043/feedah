import { createContext, useContext, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import type { Scheme, ThemeMode } from './scheme';
import { palette, type ThemeColors } from './tokens';

type ThemeContextValue = {
  mode: ThemeMode;
  scheme: Scheme;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('system');
  const systemScheme = useColorScheme();

  const scheme: Scheme = mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;
  const value: ThemeContextValue = { mode, scheme, colors: palette[scheme], setMode };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return theme;
}

import { createContext, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import type { Scheme, ThemeMode } from './scheme';
import { palette, type ThemeColors } from './tokens';

type ThemeContextValue = {
  mode: ThemeMode;
  scheme: Scheme;
  colors: ThemeColors;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Mode comes from settings; 'system' follows the OS color scheme. */
export function ThemeProvider({ mode, children }: { mode: ThemeMode; children: ReactNode }) {
  const systemScheme = useColorScheme();
  const scheme: Scheme = mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;
  const value: ThemeContextValue = { mode, scheme, colors: palette[scheme] };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return theme;
}

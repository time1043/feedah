import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { getDb } from '@/db/index';
import { SettingsProvider, useSettings } from '@/db/settings';
import { flushUsage, pauseAppUsage, startAppUsage } from '@/db/usage';
import { ThemeProvider, useTheme } from '@/theme/context';

function RootNavigator() {
  const { scheme } = useTheme();

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="feed" />
      </Stack>
    </>
  );
}

function ThemedShell() {
  const { settings } = useSettings();

  useEffect(() => {
    void getDb();
    startAppUsage();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        startAppUsage();
      } else {
        pauseAppUsage();
        void flushUsage();
      }
    });
    return () => {
      subscription.remove();
      pauseAppUsage();
      void flushUsage();
    };
  }, []);

  return (
    <ThemeProvider mode={settings.theme}>
      <RootNavigator />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SettingsProvider>
      <ThemedShell />
    </SettingsProvider>
  );
}

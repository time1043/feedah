import { useEffect, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SyncProvider } from '@/cloud/sync';
import { secureStorage } from '@/cloud/token-storage';
import { CONVEX_URL, convex } from '@/cloud/convex';
import { getDb } from '@/db/index';
import { SettingsProvider, useSettings } from '@/db/settings';
import { DrizzleStudio } from '@/db/studio';
import { flushUsage, pauseAppUsage, startAppUsage } from '@/db/usage';
import { activeReminderTimes, syncReminders } from '@/lib/reminders';
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
  const { settings, ready: settingsReady } = useSettings();

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

  // Keep the OS notification schedule in step with the reminder settings.
  // Runs on launch and after any change; a disabled feature cancels all.
  useEffect(() => {
    if (!settingsReady) return;
    const times = settings.remindersEnabled ? activeReminderTimes(settings.reminders) : [];
    syncReminders(times).catch(() => {});
  }, [settingsReady, settings.remindersEnabled, settings.reminders]);

  return (
    <ThemeProvider mode={settings.theme}>
      <RootNavigator />
      {__DEV__ && <DrizzleStudio />}
    </ThemeProvider>
  );
}

export default function RootLayout() {
  // Required for standalone builds: Expo Go supplies this provider itself,
  // a packaged APK runs only what we render, so insets would resolve to zero.
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <CloudLayer>
          <ThemedShell />
        </CloudLayer>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

/**
 * Mounts the Convex auth + sync providers only when a deployment URL is
 * configured; without one the app is exactly the local-only build it was
 * before cloud sync existed.
 */
function CloudLayer({ children }: { children: ReactNode }) {
  if (!CONVEX_URL || !convex) return <>{children}</>;
  return (
    <ConvexAuthProvider client={convex} storage={secureStorage}>
      <SyncProvider>{children}</SyncProvider>
    </ConvexAuthProvider>
  );
}

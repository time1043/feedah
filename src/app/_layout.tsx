import { useDrizzleStudio } from 'expo-drizzle-studio-plugin'

import '@/global.css'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { Platform, StatusBar as RNStatusBar } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { getDb, getRawDb } from '@/db'
import ThemeProvider from '@/providers/theme-provider'

if (Platform.OS === 'android') {
  RNStatusBar.setTranslucent(true)
  RNStatusBar.setBackgroundColor('transparent')
}

/** Dev-only bridge that exposes the raw database handle to Drizzle Studio.
 * Rendered only after getDb() has resolved, so the handle is non-null. */
function DrizzleStudioBridge() {
  useDrizzleStudio(getRawDb())
  return null
}

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false)

  useEffect(() => {
    getDb()
      .then(() => setDbReady(true))
      .catch((err) => console.error('Failed to init DB:', err))
  }, [])

  if (!dbReady) {
    return null
  }

  return (
    <ThemeProvider>
      <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['top']}>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
        {__DEV__ && <DrizzleStudioBridge />}
      </SafeAreaView>
    </ThemeProvider>
  )
}

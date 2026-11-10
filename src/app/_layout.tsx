import { useDrizzleStudio } from 'expo-drizzle-studio-plugin'

import '@/global.css'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useState } from 'react'
import { Platform, Pressable, StatusBar as RNStatusBar, Text } from 'react-native'
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

/** A failed init must not brick the session as a blank screen: the error
 * state renders a retry button, and getDb() clears its singleton on
 * failure so a retry genuinely runs the whole open-migrate-seed again. */
export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false)
  const [dbError, setDbError] = useState(false)

  // Both outcomes land in promise callbacks — nothing sets state synchronously
  // in the effect body, which would only buy an extra render on mount.
  const openDb = useCallback(() => {
    getDb()
      .then(() => setDbReady(true))
      .catch((err) => {
        console.error('Failed to init DB:', err)
        setDbError(true)
      })
  }, [])

  useEffect(openDb, [openDb])

  /** The retry button is the only path that resets the flags: clearing them
   * here (an event handler) keeps the effect free of a synchronous setState. */
  const retry = () => {
    setDbReady(false)
    setDbError(false)
    openDb()
  }

  if (!dbReady) {
    if (!dbError) {
      return null
    }
    return (
      <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['top']}>
        <Text className="text-black dark:text-white text-center">The database failed to open.</Text>
        <Pressable onPress={retry}>
          <Text className="text-black dark:text-white font-bold text-center">Retry</Text>
        </Pressable>
      </SafeAreaView>
    )
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

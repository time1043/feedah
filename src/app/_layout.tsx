import '@/global.css'
import { useDrizzleStudio } from 'expo-drizzle-studio-plugin'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { AppState, Platform, StatusBar as RNStatusBar } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { getRawDb } from '@/db/index'
import { flushUsage, pauseAppUsage, startAppUsage } from '@/db/usage'
import ThemeProvider from '@/providers/theme-provider'

if (Platform.OS === 'android') {
  RNStatusBar.setTranslucent(true)
  RNStatusBar.setBackgroundColor('transparent')
}

/** Dev-only bridge that exposes the app's database to Drizzle Studio. */
function DrizzleStudioBridge() {
  useDrizzleStudio(getRawDb())
  return null
}

export default function RootLayout() {
  // App time accrues only while the app is foregrounded and active.
  useEffect(() => {
    startAppUsage()
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') startAppUsage()
      else {
        pauseAppUsage()
        void flushUsage()
      }
    })
    return () => {
      subscription.remove()
      pauseAppUsage()
    }
  }, [])

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

import '@/global.css'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { AppState, Platform, StatusBar as RNStatusBar } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { flushUsage, pauseAppUsage, startAppUsage } from '@/db/usage'
import ThemeProvider from '@/providers/theme-provider'

if (Platform.OS === 'android') {
  RNStatusBar.setTranslucent(true)
  RNStatusBar.setBackgroundColor('transparent')
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
      </SafeAreaView>
    </ThemeProvider>
  )
}

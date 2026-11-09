import { Stack } from 'expo-router'

import '@/global.css'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { Platform, StatusBar as RNStatusBar } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { getDb } from '@/db'
import ThemeProvider from '@/providers/theme-provider'

if (Platform.OS === 'android') {
  RNStatusBar.setTranslucent(true)
  RNStatusBar.setBackgroundColor('transparent')
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
      </SafeAreaView>
    </ThemeProvider>
  )
}

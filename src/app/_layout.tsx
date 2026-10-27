import '@/global.css'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Platform, StatusBar as RNStatusBar } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import ThemeProvider from '@/providers/theme-provider'

if (Platform.OS === 'android') {
  RNStatusBar.setTranslucent(true)
  RNStatusBar.setBackgroundColor('transparent')
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SafeAreaView className="flex-1 bg-white dark:bg-black" edges={['top']}>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </SafeAreaView>
    </ThemeProvider>
  )
}

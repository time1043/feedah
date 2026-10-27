import '@/global.css'
import { Stack } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import ThemeProvider from '@/providers/theme-provider'

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SafeAreaView className="flex-1" edges={['top']}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </SafeAreaView>
    </ThemeProvider>
  )
}

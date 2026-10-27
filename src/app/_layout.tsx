import '@/global.css'
import { Stack } from 'expo-router'

import ThemeProvider from '@/providers/theme-provider'

export default function RootLayout() {
  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  )
}

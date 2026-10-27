import '@/global.css'
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router'
import { useAtomValue } from 'jotai'
import { useEffect } from 'react'
import { Appearance, Platform, useColorScheme } from 'react-native'

import { currentThemeAtom } from '@/atoms/theme'

export default function RootLayout() {
  const currentTheme = useAtomValue(currentThemeAtom)
  const colorScheme = useColorScheme()

  useEffect(() => {
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      Appearance.setColorScheme(currentTheme === 'system' ? 'unspecified' : currentTheme)
    }
  }, [currentTheme])

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack />
    </ThemeProvider>
  )
}

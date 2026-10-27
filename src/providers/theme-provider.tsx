import '@/global.css'
import { DarkTheme, DefaultTheme, ThemeProvider as ExpoThemeProvider } from 'expo-router'
import { useAtomValue } from 'jotai'
import { PropsWithChildren, useEffect } from 'react'
import { Appearance, Platform, useColorScheme } from 'react-native'

import { currentThemeAtom } from '@/atoms/theme'

export default function ThemeProvider({ children }: PropsWithChildren) {
  const currentTheme = useAtomValue(currentThemeAtom)
  const colorScheme = useColorScheme()

  useEffect(() => {
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      Appearance.setColorScheme(currentTheme === 'system' ? 'unspecified' : currentTheme)
    }
  }, [currentTheme])

  return (
    <ExpoThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {children}
    </ExpoThemeProvider>
  )
}

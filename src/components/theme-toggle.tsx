import { Appearance, Platform, Pressable, Text, useColorScheme } from 'react-native'

export default function ThemeToggle() {
  const colorScheme = useColorScheme()

  function restoreSystemTheme() {
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      Appearance.setColorScheme('unspecified')
    }
  }

  function toggleColorScheme() {
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      Appearance.setColorScheme(Appearance.getColorScheme() === 'dark' ? 'light' : 'dark')
    }
  }

  return (
    <>
      <Pressable onPress={toggleColorScheme}>
        <Text className="text-black dark:text-white">Current: {colorScheme}</Text>
      </Pressable>
      <Pressable onPress={restoreSystemTheme}>
        <Text className="text-black dark:text-white">Use system theme</Text>
      </Pressable>
    </>
  )
}

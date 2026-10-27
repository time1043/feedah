import { Appearance, Platform, Pressable, Text, View, useColorScheme } from 'react-native'

const themes = ['system', 'light', 'dark'] as const
type Theme = (typeof themes)[number]

export default function ThemeToggle() {
  const colorScheme = useColorScheme()

  function handleChangeTheme(theme: Theme) {
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      Appearance.setColorScheme(theme === 'system' ? 'unspecified' : theme)
    }
  }

  return (
    <View className="rounded-lg bg-gray-100 p-1 dark:bg-gray-800 flex-row">
      {themes.map((theme) => {
        const active =
          theme === 'system' ? Appearance.getColorScheme() === null : colorScheme === theme

        return (
          <Pressable
            key={theme}
            onPress={() => handleChangeTheme(theme)}
            className={`rounded-md px-4 py-2 flex-1 items-center ${
              active ? 'bg-white dark:bg-gray-700' : ''
            }`}
          >
            <Text className="text-sm text-black dark:text-white capitalize">{theme}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

import { useAtom } from 'jotai'
import { Pressable, Text, View } from 'react-native'

import { currentThemeAtom, themes } from '@/atoms/theme'

export default function ThemeToggle() {
  const [currentTheme, setCurrentTheme] = useAtom(currentThemeAtom)

  return (
    <View className="rounded-lg bg-gray-100 p-1 dark:bg-gray-800 flex-row">
      {themes.map((theme) => (
        <Pressable
          key={theme}
          onPress={() => setCurrentTheme(theme)}
          className={`rounded-md px-4 py-2 flex-1 items-center ${
            currentTheme === theme ? 'bg-white dark:bg-gray-700' : ''
          }`}
        >
          <Text className="text-sm text-black dark:text-white capitalize">{theme}</Text>
        </Pressable>
      ))}
    </View>
  )
}

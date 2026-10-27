import { Text, View } from 'react-native'

import ThemeToggle from '@/components/theme-toggle'

export default function Index() {
  return (
    <View className="bg-white dark:bg-black flex-1 items-center justify-center">
      <Text className="text-xl font-bold text-blue-500">Welcome to Nativewind!</Text>

      <ThemeToggle />
    </View>
  )
}

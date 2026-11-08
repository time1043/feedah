import { Text, View } from 'react-native'

import { SpeechRateControl } from '@/components/speech-rate-control'
import ThemeToggle from '@/components/theme-toggle'

/** The settings tab: one row group per setting. */
export default function SettingsScreen() {
  return (
    <View className="bg-white dark:bg-black flex-1 items-center justify-center">
      <Text className="text-xl font-bold text-blue-500">Settings</Text>

      <View className="mt-8 w-72">
        <SpeechRateControl />
      </View>

      <ThemeToggle />
    </View>
  )
}

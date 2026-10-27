import { useLocalSearchParams } from 'expo-router'
import { Text, View } from 'react-native'

export default function BrowseScreen() {
  const { position } = useLocalSearchParams<{ position: string }>()

  return (
    <View className="flex-1 items-center justify-center">
      <Text className="text-xl font-bold text-black dark:text-white">
        Browse position: {position}
      </Text>
    </View>
  )
}

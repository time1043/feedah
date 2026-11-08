import { router, useLocalSearchParams } from 'expo-router'
import { Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ListHeader } from '@/components/header'

/** The settings of one bucket. Placeholder: per-bucket settings (rename,
 * clear progress, …) come with the db. */
export default function BucketSettingsScreen() {
  const { name } = useLocalSearchParams<{ name?: string }>()
  const bucketName = Array.isArray(name) ? name[0] : name

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      <ListHeader title="Bucket settings" onBack={() => router.back()} />
      <View className="flex-1 items-center justify-center">
        <Text className="text-gray-400 dark:text-gray-500 text-[15px]">
          {bucketName
            ? `Per-bucket settings for ${bucketName} land with the database.`
            : 'Per-bucket settings land with the database.'}
        </Text>
      </View>
    </SafeAreaView>
  )
}

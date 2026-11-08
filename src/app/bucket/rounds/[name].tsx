import { router, useLocalSearchParams } from 'expo-router'
import { Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ListHeader } from '@/components/header'
import { goBack } from '@/lib/back'

/** The round list of one bucket. Placeholder: the rounds themselves come
 * with the study session and the db. */
export default function RoundsScreen() {
  const { name } = useLocalSearchParams<{ name: string }>()
  const bucketName = Array.isArray(name) ? name[0] : name

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      <ListHeader title={bucketName ? `Rounds ${bucketName}` : undefined} onBack={goBack} />
      <View className="flex-1 items-center justify-center">
        <Text className="text-gray-400 dark:text-gray-500 text-[15px]">
          The rounds list lands with the study session.
        </Text>
      </View>
    </SafeAreaView>
  )
}

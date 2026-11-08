import { router, useLocalSearchParams } from 'expo-router'
import { useAtom } from 'jotai'
import { Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { activeBucketAtom } from '@/atoms/bucket'
import { ListHeader } from '@/components/header'
import { SelectRow } from '@/components/settings/select-row'
import { buckets } from '@/mock/bucket'

/** The settings of one bucket. The picker switches the study bucket — the
 * one the home screen studies and the decks open on. The per-bucket
 * specifics (rename, clear progress, …) come with the db and stack here as
 * further rows. */
export default function BucketSettingsScreen() {
  const { name } = useLocalSearchParams<{ name?: string }>()
  const bucketName = Array.isArray(name) ? name[0] : name
  const [activeName, setActiveName] = useAtom(activeBucketAtom)

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      <ListHeader title="Bucket settings" onBack={() => router.back()} />

      {bucketName && (
        <Text className="px-4 pb-2 text-gray-400 dark:text-gray-500 text-[13px]">
          {bucketName} · per-bucket specifics land with the database
        </Text>
      )}

      <View className="px-4">
        <SelectRow
          label="Study bucket"
          value={activeName}
          options={buckets.map((bucket) => ({ value: bucket.name, label: bucket.name }))}
          onValueChange={setActiveName}
        />
      </View>
    </SafeAreaView>
  )
}

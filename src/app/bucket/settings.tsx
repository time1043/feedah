import { useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useAtom } from 'jotai'
import { useCallback, useState } from 'react'
import { Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { activeBucketAtom } from '@/atoms/bucket'
import { ListHeader } from '@/components/header'
import { SelectRow } from '@/components/settings/select-row'
import { getBuckets, type BucketRow } from '@/db/repo/bucket-word'
import { goBack } from '@/lib/back'

/** The settings of one bucket. The picker switches the study bucket — the
 * one the home screen studies and the decks open on — and its options are the
 * seeded buckets in the database, the same list the bucket tab shows. The
 * per-bucket specifics (rename, clear progress, …) stack here as further
 * rows. */
export default function BucketSettingsScreen() {
  const { name } = useLocalSearchParams<{ name?: string }>()
  const bucketName = Array.isArray(name) ? name[0] : name
  const [activeName, setActiveName] = useAtom(activeBucketAtom)
  const [buckets, setBuckets] = useState<BucketRow[]>([])

  // Reloads on every focus: the options follow the database.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      void (async () => {
        try {
          const rows = await getBuckets()
          if (!cancelled) setBuckets(rows)
        } catch (error) {
          console.error('[bucket settings] load failed', error)
        }
      })()
      return () => {
        cancelled = true
      }
    }, []),
  )

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      <ListHeader title="Bucket settings" onBack={goBack} />

      {bucketName && (
        <Text className="px-4 pb-2 text-gray-400 dark:text-gray-500 text-[13px]">{bucketName}</Text>
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

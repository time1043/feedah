import { useFocusEffect } from 'expo-router'
import { useAtom } from 'jotai'
import { useCallback, useState } from 'react'
import { View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { activeBucketAtom } from '@/atoms/bucket'
import { ListHeader } from '@/components/header'
import { SelectRow } from '@/components/settings/select-row'
import { getBuckets, type BucketRow } from '@/db/repo/bucket-word'
import { goBack } from '@/lib/back'

/**
 * The bucket settings — for the list as a whole, not for one bucket: there is
 * no bucket in the route, and the picker switches the study bucket (the one
 * the home screen studies and the decks open on). Its options are the seeded
 * buckets in the database, the same list the bucket tab shows.
 */
export default function BucketSettingsScreen() {
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

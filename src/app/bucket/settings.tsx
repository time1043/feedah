import { useFocusEffect } from 'expo-router'
import { useAtom } from 'jotai'
import { useCallback, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { activeBucketAtom } from '@/atoms/bucket'
import { searchScopeAtom, studyDrillAtom } from '@/atoms/settings'
import { ListHeader } from '@/components/header'
import { SelectRow } from '@/components/settings/select-row'
import {
  getBuckets,
  restoreBuckets,
  tombstonedBuckets,
  type BucketRow,
} from '@/db/repo/bucket-word'
import { getDrills } from '@/drills/registry'
import { goBack } from '@/lib/back'

/**
 * The bucket settings — for the list as a whole, not for one bucket: there is
 * no bucket in the route, and the picker switches the study bucket (the one
 * the home screen studies and the decks open on). Its options are the seeded
 * buckets in the database, the same list the bucket tab shows.
 */
export default function BucketSettingsScreen() {
  const [activeName, setActiveName] = useAtom(activeBucketAtom)
  const [studyDrill, setStudyDrill] = useAtom(studyDrillAtom)
  const [searchScope, setSearchScope] = useAtom(searchScopeAtom)
  const [buckets, setBuckets] = useState<BucketRow[]>([])
  // The deleted bundled buckets: the restore section renders only while
  // there is something to restore.
  const [deleted, setDeleted] = useState<string[]>([])

  // Reloads on every focus: the options follow the database.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      void (async () => {
        try {
          const [rows, tombstoned] = await Promise.all([getBuckets(), tombstonedBuckets()])
          if (!cancelled) {
            setBuckets(rows)
            setDeleted(tombstoned)
          }
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

      {/* Default study mode: what the home screen's Study entry opens. The
          chips are the registry's manifest order — a new drill joins them
          with no other change. */}
      <View className="px-4 pt-8">
        <Text className="font-semibold text-black dark:text-white text-[15px]">
          Default study mode
        </Text>
        <Text className="mt-1 text-gray-500 dark:text-gray-400 text-[13px]">
          Used by Study on the home screen.
        </Text>
        <View className="mt-3 gap-2 flex-row">
          {getDrills().map((drill) => (
            <Pressable
              key={drill.id}
              onPress={() => setStudyDrill(drill.id)}
              className={`rounded-lg p-2.5 flex-1 items-center border ${
                drill.id === studyDrill
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                  : 'border-gray-300 dark:border-gray-700'
              }`}
            >
              <Text
                className={`font-semibold text-[13px] ${
                  drill.id === studyDrill ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {drill.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Global search scope: which buckets the unpinned search spans. The
          chips toggle one bucket each; an empty scope means every bucket. */}
      <View className="px-4 pt-8">
        <Text className="font-semibold text-black dark:text-white text-[15px]">
          Global search scope
        </Text>
        <Text className="mt-1 text-gray-500 dark:text-gray-400 text-[13px]">
          {searchScope.length === 0 ? 'Searching every bucket' : 'Tapped buckets are searched'}
        </Text>
        <View className="mt-3 gap-2 flex-row flex-wrap">
          {buckets.map((bucket) => {
            const active = searchScope.includes(bucket.name)
            return (
              <Pressable
                key={bucket.name}
                onPress={() =>
                  setSearchScope(
                    active
                      ? searchScope.filter((name) => name !== bucket.name)
                      : [...searchScope, bucket.name],
                  )
                }
                className={`rounded-lg p-2.5 items-center border ${
                  active
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                    : 'border-gray-300 dark:border-gray-700'
                }`}
              >
                <Text
                  className={`font-semibold text-[13px] ${
                    active ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {bucket.name}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      {/* Restore the deleted built-ins: pure recovery, no confirmation — the
          rows were never gone, only hidden. */}
      {deleted.length > 0 && (
        <View className="px-4 pt-8">
          <Text className="font-semibold text-black dark:text-white text-[15px]">
            Restore built-in buckets
          </Text>
          <Text className="mt-1 text-gray-500 dark:text-gray-400 text-[13px]">
            They come back with their full history.
          </Text>
          <View className="mt-3 gap-2 flex-row flex-wrap">
            {deleted.map((name) => (
              <Pressable
                key={name}
                onPress={() => {
                  void restoreBuckets([name]).then(async () => {
                    const [rows, tombstoned] = await Promise.all([
                      getBuckets(),
                      tombstonedBuckets(),
                    ])
                    setBuckets(rows)
                    setDeleted(tombstoned)
                  })
                }}
                className="rounded-lg p-2.5 border-gray-300 dark:border-gray-700 items-center border"
              >
                <Text className="font-semibold text-gray-500 dark:text-gray-400 text-[13px]">
                  {name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </SafeAreaView>
  )
}

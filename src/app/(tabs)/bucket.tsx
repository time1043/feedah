import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, Text, useColorScheme, View } from 'react-native'

import { HeaderIconButton, MUTED, TabHeader } from '@/components/header'
import { getBuckets, type BucketRow } from '@/db/repo/bucket-word'
import { useNavGuard } from '@/lib/use-nav-guard'

/** The bucket tab: one clean card per bucket read from the database — name
 * plus word count. The card's body opens the word list; its side opens the
 * round list; the gear opens the settings. The reference's progress
 * readout, import and delete all wait for the session and the db. */
export default function BucketScreen() {
  const dark = useColorScheme() === 'dark'
  const guardedPush = useNavGuard()
  // Reloads on every focus: the list follows the database, which later
  // grows (import, delete) without this screen knowing.
  const [buckets, setBuckets] = useState<BucketRow[]>([])
  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      void getBuckets().then((rows) => {
        if (!cancelled) setBuckets(rows)
      })
      return () => {
        cancelled = true
      }
    }, []),
  )

  return (
    <View className="bg-white dark:bg-black flex-1">
      <TabHeader
        title="Bucket"
        right={
          <HeaderIconButton
            name="settings-outline"
            onPress={() => guardedPush(() => router.push('/bucket/settings'))}
            accessibilityLabel="Bucket list settings"
          />
        }
      />
      {buckets.map((bucket) => (
        <View
          key={bucket.name}
          className="mx-4 mb-3 rounded-2xl border-gray-300 dark:border-gray-700 flex-row items-stretch border"
        >
          {/* Body: the bucket's word list. */}
          <Pressable
            className="p-4 flex-1 flex-row items-center justify-between"
            accessibilityRole="button"
            accessibilityLabel={`${bucket.name}, ${bucket.wordCount} words`}
            onPress={() =>
              guardedPush(() =>
                router.push({ pathname: '/bucket/words/[name]', params: { name: bucket.name } }),
              )
            }
          >
            <Text className="font-semibold text-black dark:text-white text-[17px]">
              {bucket.name}
            </Text>
            <Text
              className="text-gray-500 dark:text-gray-400 text-[13px]"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {bucket.wordCount} words
            </Text>
          </Pressable>
          {/* Side: the round list. */}
          <Pressable
            className="w-14 items-center justify-center"
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={`Rounds of ${bucket.name}`}
            onPress={() =>
              guardedPush(() =>
                router.push({ pathname: '/bucket/rounds/[name]', params: { name: bucket.name } }),
              )
            }
          >
            <Ionicons name="repeat" size={20} color={MUTED[dark ? 'dark' : 'light']} />
          </Pressable>
        </View>
      ))}
      {buckets.length === 0 && (
        <Text className="p-4 text-gray-400 dark:text-gray-500 text-[15px]">
          No buckets yet — they seed on the first database open.
        </Text>
      )}
    </View>
  )
}

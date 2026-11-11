import { router, useFocusEffect } from 'expo-router'
import { useAtomValue } from 'jotai'
import { useCallback, useEffect, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'

import { activeBucketAtom } from '@/atoms/bucket'
import { getFirstPosition } from '@/db/repo/bucket-word'
import { countRoundFlags, getProgress } from '@/db/repo/study-round'

export default function Index() {
  const activeName = useAtomValue(activeBucketAtom)
  // The browse box takes the CARD NUMBER (the data position printed on the
  // card). It follows the active bucket's first card — derived, not
  // captured, so a settings switch and the storage hydration both land —
  // until the user types a number of their own.
  const [typedPosition, setTypedPosition] = useState<string | null>(null)
  // null = the database has not answered yet (or the bucket is empty): the
  // box stays blank instead of naming a card that may not exist.
  const [firstPosition, setFirstPosition] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const first = await getFirstPosition(activeName)
        if (!cancelled) setFirstPosition(first === null ? '' : String(first))
      } catch (error) {
        console.error('[home] first position failed', error)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeName])
  const defaultPosition = firstPosition ?? ''
  const position = typedPosition ?? defaultPosition

  // The review entry reads the live round's flags on every focus: the button
  // is the review walk's front door, and a round with no marks has nothing
  // to walk. null = the database has not answered yet.
  const [flagCount, setFlagCount] = useState<number | null>(null)
  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      void (async () => {
        try {
          const progress = await getProgress(activeName)
          const count = await countRoundFlags(activeName, progress.round)
          if (!cancelled) setFlagCount(count)
        } catch (error) {
          console.error('[home] flag count failed', error)
        }
      })()
      return () => {
        cancelled = true
      }
    }, [activeName]),
  )

  return (
    <View className="gap-6 bg-white p-6 dark:bg-black flex-1 items-center justify-center">
      <View className="max-w-sm gap-3 w-full">
        <Text className="font-semibold text-black dark:text-white">Navigation</Text>

        <View className="gap-2 flex-row items-center">
          <TextInput
            className="min-w-0 rounded-lg border-gray-300 p-3 text-black dark:border-gray-700 dark:text-white flex-1 border"
            keyboardType="numeric"
            value={position}
            onChangeText={setTypedPosition}
            placeholder="Position"
            placeholderTextColor="#9ca3af"
          />

          <Pressable
            className="rounded-lg bg-blue-500 px-5 py-3"
            onPress={() =>
              router.push({
                pathname: '/mode/browse/[position]',
                params: { position },
              })
            }
          >
            <Text className="font-medium text-white">Browse</Text>
          </Pressable>
        </View>

        <Pressable
          className="rounded-lg border-gray-300 p-3 dark:border-gray-700 border"
          onPress={() => router.push('/mode/study')}
        >
          <Text className="text-black dark:text-white">Study</Text>
        </Pressable>

        <Pressable
          className="rounded-lg border-gray-300 p-3 dark:border-gray-700 border disabled:opacity-40"
          disabled={flagCount === null || flagCount === 0}
          onPress={() => router.push('/mode/review')}
        >
          <Text className="text-black dark:text-white">
            Review{flagCount === null ? '' : ` · ${flagCount}`}
          </Text>
        </Pressable>

        <Pressable
          className="rounded-lg border-gray-300 p-3 dark:border-gray-700 border"
          onPress={() => router.push('/mode/search')}
        >
          <Text className="text-black dark:text-white">Search</Text>
        </Pressable>
      </View>
    </View>
  )
}

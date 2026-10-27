import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useAtomValue, useSetAtom } from 'jotai'
import { useMemo, useState } from 'react'
import { Pressable, Text, View, useColorScheme } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { DeckWord } from '@/types/word'

import { activeBucketAtom, flagKey, flagsAtom, toggleFlagAtom } from '@/atoms/study'
import { WordDeck } from '@/components/word-deck'
import { speakWord } from '@/lib/speech'
import { findBucketByName } from '@/mock/data'

/**
 * Review pass over the bucket's currently flagged words. The queue is
 * snapshotted on entry: unflagging during the session updates the bookmark
 * but the word stays until the next pass. Nothing is recorded — no pointer,
 * no rounds — and finishing the queue closes the session.
 */
export default function ReviewScreen() {
  const scheme = useColorScheme() ?? 'light'
  const bucketName = useAtomValue(activeBucketAtom)
  const flags = useAtomValue(flagsAtom)
  const toggleFlag = useSetAtom(toggleFlagAtom)
  const bucket = findBucketByName(bucketName)

  // Snapshot on entry; flag freshness comes from the atoms at render time.
  const [queue] = useState(() => bucket.words.filter((word) => flags[flagKey(bucketName, word)]))
  const words: DeckWord[] = useMemo(
    () => queue.map((word) => ({ ...word, flagged: !!flags[flagKey(bucketName, word)] })),
    [queue, bucketName, flags],
  )

  if (words.length === 0) {
    return (
      <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
        <View className="min-h-11 px-4 py-2 flex-row items-center">
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close review">
            <Ionicons
              name="chevron-down"
              size={28}
              color={scheme === 'dark' ? '#7A7E86' : '#9A9EA6'}
            />
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-400 dark:text-gray-500 text-[17px]">Nothing flagged yet</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      <WordDeck
        words={words}
        resetKey={bucketName}
        onSpeak={(word) => speakWord(word.word)}
        onToggleFlag={(word) => toggleFlag({ bucket: bucketName, word })}
        scrubbable
        headerCenter={
          <Text className="font-semibold text-gray-500 dark:text-gray-400 text-[13px]">
            Review · {bucketName}
          </Text>
        }
        onClose={() => router.back()}
        end={{
          render: () => (
            <View className="gap-2 flex-1 items-center justify-center">
              <Text className="font-bold text-black dark:text-white text-[28px]">
                Review complete
              </Text>
              <Text className="text-gray-400 dark:text-gray-500 text-[17px]">Nice work</Text>
            </View>
          ),
          action: 'close',
        }}
      />
    </SafeAreaView>
  )
}

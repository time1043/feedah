import { router, useLocalSearchParams } from 'expo-router'
import { useAtomValue, useSetAtom } from 'jotai'
import { useMemo } from 'react'
import { Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { DeckWord } from '@/types/word'

import { activeBucketAtom, flagKey, flagsAtom, toggleFlagAtom } from '@/atoms/study'
import { WordDeck } from '@/components/word-deck'
import { speakWord } from '@/lib/speech'
import { findBucketByName } from '@/mock/data'

/**
 * Word browser: swipe up/down through the whole bucket, scrub with the
 * progress bar, flag words. Purely a lookup — none of it counts as studying,
 * moves the pointer, or records anything.
 */
export default function BrowseScreen() {
  const { position } = useLocalSearchParams<{ position: string }>()
  const bucketName = useAtomValue(activeBucketAtom)
  const flags = useAtomValue(flagsAtom)
  const toggleFlag = useSetAtom(toggleFlagAtom)
  const bucket = findBucketByName(bucketName)

  const words: DeckWord[] = useMemo(
    () => bucket.words.map((word) => ({ ...word, flagged: !!flags[flagKey(bucketName, word)] })),
    [bucket, bucketName, flags],
  )

  // Route param is a 1-based word position.
  const requested = Number(position)
  const initial =
    Number.isInteger(requested) && requested > 0 ? Math.min(requested, words.length) - 1 : 0

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      <WordDeck
        words={words}
        resetKey={`${bucketName}:${initial}`}
        initialIndex={initial}
        onSpeak={(word) => speakWord(word.word)}
        onToggleFlag={(word) => toggleFlag({ bucket: bucketName, word })}
        scrubbable
        headerCenter={
          <Text className="font-semibold text-gray-500 dark:text-gray-400 text-[13px]">
            Browse · {bucketName}
          </Text>
        }
        onClose={() => router.back()}
      />
    </SafeAreaView>
  )
}

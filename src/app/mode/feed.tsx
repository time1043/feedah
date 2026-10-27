import { router } from 'expo-router'
import { useAtomValue, useSetAtom } from 'jotai'
import { useMemo, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { DeckWord } from '@/types/word'

import {
  DEFAULT_PROGRESS,
  activeBucketAtom,
  flagKey,
  flagsAtom,
  nextRoundAtom,
  progressAtom,
  settlePointerAtom,
  toggleFlagAtom,
} from '@/atoms/study'
import { WordDeck, type WordDeckHandle } from '@/components/word-deck'
import { speakWord } from '@/lib/speech'
import { findBucketByName } from '@/mock/data'

/**
 * The study feed: swiping through the active bucket records progress. The
 * header pill appears once the user scrubs away from the frontier — browsing
 * records nothing — and returns to the first unlearned card on tap. Reaching
 * the end page starts the next round, back at the first card.
 */
export default function FeedScreen() {
  const bucketName = useAtomValue(activeBucketAtom)
  const progress = useAtomValue(progressAtom)[bucketName] ?? DEFAULT_PROGRESS
  const flags = useAtomValue(flagsAtom)
  const settlePointer = useSetAtom(settlePointerAtom)
  const startNextRound = useSetAtom(nextRoundAtom)
  const toggleFlag = useSetAtom(toggleFlagAtom)

  const bucket = findBucketByName(bucketName)
  // Flag state rides on the word list so cards re-render when it flips; the
  // list identity is stable otherwise.
  const words: DeckWord[] = useMemo(
    () => bucket.words.map((word) => ({ ...word, flagged: !!flags[flagKey(bucketName, word)] })),
    [bucket, bucketName, flags],
  )

  const [browsing, setBrowsing] = useState(false)
  const deckRef = useRef<WordDeckHandle>(null)

  const frontier = Math.min(progress.pointer, words.length)

  const resumeStudying = () => {
    setBrowsing(false)
    deckRef.current?.scrollTo(frontier)
  }

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      <WordDeck
        ref={deckRef}
        words={words}
        resetKey={bucketName}
        initialIndex={frontier}
        onSpeak={(word) => speakWord(word.word)}
        onSettle={(_, index) => {
          if (!browsing && index > progress.pointer) {
            settlePointer({ bucket: bucketName, pointer: index })
          }
        }}
        onScrub={() => setBrowsing(true)}
        onToggleFlag={(word) => toggleFlag({ bucket: bucketName, word })}
        onClose={() => router.back()}
        scrubbable={progress.pointer > 0}
        headerCenter={
          browsing ? (
            <Pressable className="bg-blue-500 px-4 py-1.5 rounded-full" onPress={resumeStudying}>
              <Text className="font-semibold text-white text-[13px]">Resume studying</Text>
            </Pressable>
          ) : (
            <Text className="font-semibold text-gray-500 dark:text-gray-400 text-[13px]">
              Feed · {bucketName}
            </Text>
          )
        }
        end={{
          render: () => (
            <View className="gap-2 flex-1 items-center justify-center">
              <Text className="font-bold text-black dark:text-white text-[28px]">
                Round complete
              </Text>
              <Text className="text-gray-400 dark:text-gray-500 text-[17px]">
                Round {progress.round} starts in a moment
              </Text>
            </View>
          ),
          onReached: () => {
            // Completing a round requires having walked the whole bucket in
            // study mode; scrubbing to the end records nothing.
            if (browsing || progress.pointer < words.length - 1) return false
            startNextRound(bucketName)
            setBrowsing(false)
          },
          action: 'reset',
        }}
      />
    </SafeAreaView>
  )
}

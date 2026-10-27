import { router, useFocusEffect } from 'expo-router'
import { useAtomValue } from 'jotai'
import { useCallback, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { activeBucketAtom, hudPageAtom, hudRoundAtom } from '@/atoms/settings'
import { WordDeck, type WordDeckHandle } from '@/components/word-deck'
import {
  completeRound,
  getProgress,
  getWordsWithRoundFlag,
  settleCard,
  setRoundFlag,
  type Progress,
  type WordWithFlag,
} from '@/db/repo'
import { speakWord } from '@/lib/speech'
import { useStudyUsage } from '@/lib/use-study-usage'

type FeedState = { words: WordWithFlag[]; progress: Progress }

/**
 * The study feed: swiping through the active bucket records the probe. The
 * header pill appears once the user scrubs away from the frontier — browsing
 * records nothing — and returns to the first unlearned card on tap. Reaching
 * the end page completes the round and starts the next one.
 */
export default function FeedScreen() {
  const bucketName = useAtomValue(activeBucketAtom)
  const showPage = useAtomValue(hudPageAtom)
  const showRound = useAtomValue(hudRoundAtom)
  const [loaded, setLoaded] = useState<FeedState | null>(null)
  const [browsing, setBrowsing] = useState(false)
  useStudyUsage()
  const deckRef = useRef<WordDeckHandle>(null)

  // Reloads on every focus: a review pushed on top may have re-flagged words.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      void (async () => {
        const progress = await getProgress(bucketName)
        const words = await getWordsWithRoundFlag(bucketName, progress.round)
        if (!cancelled) setLoaded({ words, progress })
      })()
      return () => {
        cancelled = true
      }
    }, [bucketName]),
  )

  if (!loaded) {
    return <View className="bg-white dark:bg-black flex-1" />
  }
  const { words, progress } = loaded
  const frontier = Math.min(progress.pointer, words.length)

  const patch = (changes: Partial<FeedState>) => setLoaded({ words, progress, ...changes })

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
          if (browsing || index <= progress.pointer) return
          patch({ progress: { ...progress, pointer: index } })
          void settleCard(bucketName, index)
        }}
        onScrub={() => setBrowsing(true)}
        onToggleFlag={(word) => {
          const flagged = !word.flagged
          patch({ words: words.map((w) => (w.position === word.position ? { ...w, flagged } : w)) })
          void setRoundFlag(bucketName, progress.round, word.position, flagged)
        }}
        hudLeft={
          showRound ? (
            <Text className="text-gray-400 dark:text-gray-500 text-[13px]">
              round {progress.round}
            </Text>
          ) : undefined
        }
        hudRight={
          showPage ? (
            <Text
              className="text-gray-400 dark:text-gray-500 text-[13px]"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {progress.pointer}/{words.length}
            </Text>
          ) : undefined
        }
        onSearch={() => router.push({ pathname: '/mode/search', params: { bucket: bucketName } })}
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
            const round = progress.round + 1
            patch({ progress: { ...progress, round, pointer: 0, roundStartedAt: Date.now() } })
            setBrowsing(false)
            void completeRound(bucketName)
            // The new round starts with an empty flag list: reload the cards
            // so the bookmarks reflect it.
            void getWordsWithRoundFlag(bucketName, round).then((fresh) => {
              setLoaded((prev) => (prev ? { ...prev, words: fresh } : prev))
            })
          },
          action: 'reset',
        }}
      />
    </SafeAreaView>
  )
}

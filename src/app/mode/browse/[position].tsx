import { router, useLocalSearchParams } from 'expo-router'
import { useAtomValue } from 'jotai'
import { useEffect, useState } from 'react'
import { Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { activeBucketAtom, hudPageAtom } from '@/atoms/settings'
import { WordDeck } from '@/components/word-deck'
import { getProgress, getWordsWithRoundFlag, setRoundFlag, type WordWithFlag } from '@/db/repo'
import { speakWord } from '@/lib/speech'

/**
 * Word browser: swipe up/down through the whole bucket, scrub with the
 * progress bar, flag words. Purely a lookup — none of it counts as studying,
 * moves the pointer, or records anything. Flag writes target the pinned
 * round (a browse opened from a review inherits that round) or the probe's
 * round when there is none.
 */
export default function BrowseScreen() {
  const {
    position,
    bucket: bucketParam,
    round: roundParam,
  } = useLocalSearchParams<{
    position: string
    bucket?: string
    round?: string
  }>()
  // The opener can pin a bucket (the word list); otherwise the active one.
  const activeName = useAtomValue(activeBucketAtom)
  const bucketName = bucketParam ?? activeName
  const showPage = useAtomValue(hudPageAtom)

  const [loaded, setLoaded] = useState<{
    words: WordWithFlag[]
    round: number
    seen: number
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoaded(null)
    void (async () => {
      const requested = Number(roundParam)
      const target =
        Number.isInteger(requested) && requested > 0
          ? requested
          : (await getProgress(bucketName)).round
      const words = await getWordsWithRoundFlag(bucketName, target)
      if (cancelled) return
      setLoaded({ words, round: target, seen: 1 })
    })()
    return () => {
      cancelled = true
    }
  }, [bucketName, roundParam])

  if (!loaded) {
    return <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']} />
  }

  const { words, round, seen } = loaded
  // Route param is a 1-based word position.
  const requested = Number(position)
  const initial =
    Number.isInteger(requested) && requested > 0 ? Math.min(requested, words.length) - 1 : 0

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      <WordDeck
        words={words}
        resetKey={`${bucketName}:${round}:${initial}`}
        initialIndex={initial}
        onSpeak={(word) => speakWord(word.word)}
        onSettle={(_, index) => {
          setLoaded({ ...loaded, seen: index + 1 })
        }}
        onScrub={(index) => {
          setLoaded({ ...loaded, seen: index + 1 })
        }}
        onToggleFlag={(word) => {
          const flagged = !word.flagged
          setLoaded({
            ...loaded,
            words: words.map((w) => (w.position === word.position ? { ...w, flagged } : w)),
          })
          void setRoundFlag(bucketName, round, word.position, flagged)
        }}
        scrubbable
        headerCenter={
          <Text className="font-semibold text-gray-500 dark:text-gray-400 text-[13px]">
            Browse · {bucketName}
          </Text>
        }
        hudRight={
          showPage ? (
            <Text
              className="text-gray-400 dark:text-gray-500 text-[13px]"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {Math.min(seen, words.length)}/{words.length}
            </Text>
          ) : undefined
        }
        onClose={() => router.back()}
      />
    </SafeAreaView>
  )
}

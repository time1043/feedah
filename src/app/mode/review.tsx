import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useAtomValue } from 'jotai'
import { useEffect, useState } from 'react'
import { Pressable, Text, View, useColorScheme } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { DeckWord } from '@/types/word'

import { activeBucketAtom, hudPageAtom, hudRoundAtom } from '@/atoms/settings'
import { WordDeck } from '@/components/word-deck'
import {
  countedReviewCount,
  finishReview,
  getProgress,
  getWordsWithRoundFlag,
  openReviewSession,
  settleReview,
  setRoundFlag,
  type ReviewSessionRow,
} from '@/db/repo'
import { speakWord } from '@/lib/speech'
import { useStudyUsage } from '@/lib/use-study-usage'

type ReviewState = {
  session: ReviewSessionRow
  queue: DeckWord[]
  /** Real walk-throughs before this one; drafts display countedCount + 1. */
  countedCount: number
  /** Card to resume from: the first queue word at or after the watermark. */
  startIndex: number
  /** Cards seen, for the footer page number. */
  seen: number
}

/**
 * Review of one round's flag list (default: the probe's round). The queue is
 * the session's frozen snapshot; unflagging during the walk updates the
 * round's flag list and the bookmark, but the word stays until the next
 * pass. Nothing but the session is recorded.
 */
export default function ReviewScreen() {
  const scheme = useColorScheme() ?? 'light'
  const params = useLocalSearchParams<{ bucket?: string; round?: string }>()
  const activeName = useAtomValue(activeBucketAtom)
  const bucketName = typeof params.bucket === 'string' && params.bucket ? params.bucket : activeName
  const showPage = useAtomValue(hudPageAtom)
  const showRound = useAtomValue(hudRoundAtom)

  const [loaded, setLoaded] = useState<ReviewState | null>(null)
  const [empty, setEmpty] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoaded(null)
    setEmpty(false)
    void (async () => {
      const requested = Number(params.round)
      const round =
        Number.isInteger(requested) && requested > 0
          ? requested
          : (await getProgress(bucketName)).round
      const session = await openReviewSession(bucketName, round)
      if (cancelled) return
      if (!session) {
        setEmpty(true)
        return
      }
      const words = await getWordsWithRoundFlag(bucketName, round)
      const byPosition = new Map(words.map((word) => [word.position, word]))
      const queue: DeckWord[] = session.queue.flatMap((position) => {
        const word = byPosition.get(position)
        return word ? [word] : []
      })
      // The draft's displayed number is the one it is aiming for.
      const countedCount = session.counted
        ? (session.number ?? 1) - 1
        : await countedReviewCount(bucketName, round)
      const rawStart = queue.findIndex((word) => word.position >= session.lastPosition)
      const startIndex = rawStart < 0 ? 0 : rawStart
      if (!cancelled) setLoaded({ session, queue, countedCount, startIndex, seen: startIndex + 1 })
    })()
    return () => {
      cancelled = true
    }
  }, [bucketName, params.round])

  if (empty) {
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
  if (!loaded) {
    return <View className="bg-white dark:bg-black flex-1" />
  }

  const { session, queue, countedCount, startIndex, seen } = loaded
  const timeLabel = session.counted
    ? `time ${session.number}`
    : `time ${countedCount + 1} · uncounted`
  const hudTextClass = 'text-[13px] text-gray-400 dark:text-gray-500'

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      <WordDeck
        words={queue}
        resetKey={`${bucketName}:${session.round}:${session.id}`}
        initialIndex={startIndex}
        onSpeak={(word) => speakWord(word.word)}
        onSettle={(word, index) => {
          void settleReview(session.id, word.position)
          setLoaded({ ...loaded, seen: index + 1 })
        }}
        onScrub={(index) => {
          setLoaded({ ...loaded, seen: index + 1 })
        }}
        onToggleFlag={(word) => {
          const flagged = !word.flagged
          setLoaded({
            ...loaded,
            queue: queue.map((w) => (w.position === word.position ? { ...w, flagged } : w)),
          })
          void setRoundFlag(bucketName, session.round, word.position, flagged)
        }}
        onSearch={() =>
          router.push({
            pathname: '/mode/search',
            params: { bucket: bucketName, round: String(session.round) },
          })
        }
        onClose={() => router.back()}
        scrubbable
        headerCenter={
          <Text className="font-semibold text-gray-500 dark:text-gray-400 text-[13px]">
            Review {bucketName} {session.round}
          </Text>
        }
        hudLeft={showRound ? <Text className={hudTextClass}>{timeLabel}</Text> : undefined}
        hudRight={
          showPage ? (
            <Text className={hudTextClass} style={{ fontVariant: ['tabular-nums'] }}>
              {Math.min(seen, queue.length)}/{queue.length}
            </Text>
          ) : undefined
        }
        end={{
          render: () => (
            <View className="gap-2 flex-1 items-center justify-center">
              <Text className="font-bold text-black dark:text-white text-[28px]">
                Review complete
              </Text>
              <Text className="text-gray-400 dark:text-gray-500 text-[17px]">{timeLabel}</Text>
            </View>
          ),
          onReached: () => {
            void finishReview(session.id)
          },
          action: 'close',
        }}
      />
    </SafeAreaView>
  )
}

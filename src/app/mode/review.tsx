import { router, useLocalSearchParams } from 'expo-router'
import { useAtom, useAtomValue } from 'jotai'
import { useEffect, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { AnswerState } from '@/study/types'
import type { DeckWord } from '@/types/word'

import { activeBucketAtom, hudPageAtom, hudRoundAtom, studyModeAtom } from '@/atoms/settings'
import { ScreenHeader } from '@/components/header'
import { WordDeckHandle } from '@/components/word-deck'
import { WordDeck } from '@/components/word-deck'
import {
  countedReviewCount,
  finishReview,
  getProgress,
  getWordsWithRoundFlag,
  openReviewSession,
  recordAnswer,
  settleReview,
  setRoundFlag,
  type ReviewSessionRow,
} from '@/db/repo'
import { speakWord } from '@/lib/speech'
import { useStudyUsage } from '@/lib/use-study-usage'
import { getStudyMode } from '@/study/modes'

type ReviewState = {
  session: ReviewSessionRow
  queue: DeckWord[]
  /** Real walk-throughs before this one; drafts display countedCount + 1. */
  countedCount: number
  /** Card to resume from: the first queue word at or after the watermark. */
  startIndex: number
  /** Cards seen, for the footer page number. */
  seen: number
  /** Per-card answer state, keyed by word position. */
  answers: Record<number, AnswerState>
  /** Per-card draft text (typing), surviving card recycling. */
  drafts: Record<number, string>
}

/**
 * Review of one round's flag list, in any study mode. The queue is the
 * session's frozen snapshot; unflagging during the walk updates the round's
 * flag list and the bookmark, but the word stays until the next pass.
 * Answers append to answer_log; gated modes lock the deck until the card
 * on screen is answered or revealed.
 */
export default function ReviewScreen() {
  const params = useLocalSearchParams<{ bucket?: string; round?: string }>()
  const activeName = useAtomValue(activeBucketAtom)
  const bucketName = typeof params.bucket === 'string' && params.bucket ? params.bucket : activeName
  const [studyMode] = useAtom(studyModeAtom)
  const mode = getStudyMode(studyMode)
  const showPage = useAtomValue(hudPageAtom)
  const showRound = useAtomValue(hudRoundAtom)

  const [loaded, setLoaded] = useState<ReviewState | null>(null)
  const [empty, setEmpty] = useState(false)
  const deckRef = useRef<WordDeckHandle>(null)
  // Pending auto-advance after a correct answer; cancelled on unmount.
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
      // The mode's payloads (choice options) build from the whole bucket —
      // the flag list alone is too small a distractor pool.
      mode.prepare?.(words)
      if (!cancelled) {
        setLoaded({
          session,
          queue,
          countedCount,
          startIndex,
          seen: startIndex + 1,
          answers: {},
          drafts: {},
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bucketName, params.round, mode])

  // A pending auto-advance must not fire after the screen is gone.
  useEffect(
    () => () => {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current)
    },
    [],
  )

  if (empty) {
    return (
      <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
        <ScreenHeader title="Review" onBack={() => router.back()} />
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
        autoSpeak={mode.speakOnSettle}
        onSpeak={(word) => speakWord(word.word)}
        renderCard={(word: DeckWord, helpers) =>
          mode.renderCard({
            word,
            answered: loaded.answers[word.position],
            onAnswer: (correct, picked) => {
              setLoaded((prev) =>
                prev
                  ? {
                      ...prev,
                      answers: { ...prev.answers, [word.position]: { correct, picked } },
                    }
                  : prev,
              )
              void recordAnswer({
                bucketId: bucketName,
                round: session.round,
                position: word.position,
                mode: mode.id,
                correct,
              })
              // A correct answer advances on its own — but only while the
              // answered card is still the one on screen.
              if (correct && mode.autoAdvanceMs) {
                if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current)
                autoAdvanceTimer.current = setTimeout(() => {
                  if (deckRef.current?.showsWord(word.position)) deckRef.current.advance()
                }, mode.autoAdvanceMs)
              }
            },
            onSkip: () =>
              setLoaded((prev) =>
                prev
                  ? { ...prev, answers: { ...prev.answers, [word.position]: { skipped: true } } }
                  : prev,
              ),
            draft: loaded.drafts[word.position] ?? '',
            onDraft: (value) =>
              setLoaded((prev) =>
                prev ? { ...prev, drafts: { ...prev.drafts, [word.position]: value } } : prev,
              ),
            onReplay: helpers.onReplay,
            onToggleFlag: () => {
              const flagged = !word.flagged
              setLoaded((prev) =>
                prev
                  ? {
                      ...prev,
                      queue: prev.queue.map((w) =>
                        w.position === word.position ? { ...w, flagged } : w,
                      ),
                    }
                  : prev,
              )
              void setRoundFlag(bucketName, session.round, word.position, flagged)
            },
          })
        }
        canSettle={(from, to) => {
          // Gated modes: the card being left must be answered or revealed.
          if (mode.scrollable) return true
          const fromWord = queue[from]
          if (!fromWord) return true
          return loaded.answers[fromWord.position] !== undefined
        }}
        onSettle={(word, index) => {
          void settleReview(session.id, word.position)
          setLoaded((prev) => (prev ? { ...prev, seen: index + 1 } : prev))
        }}
        onScrub={(index) => {
          setLoaded((prev) => (prev ? { ...prev, seen: index + 1 } : prev))
        }}
        onToggleFlag={(word) => {
          const flagged = !word.flagged
          setLoaded((prev) =>
            prev
              ? {
                  ...prev,
                  queue: prev.queue.map((w) =>
                    w.position === word.position ? { ...w, flagged } : w,
                  ),
                }
              : prev,
          )
          void setRoundFlag(bucketName, session.round, word.position, flagged)
        }}
        onSearch={() =>
          router.push({
            pathname: '/mode/search',
            params: { bucket: bucketName, round: String(session.round) },
          })
        }
        onClose={() => router.back()}
        scrubbable={mode.scrubbable}
        scrollEnabled={mode.scrollable}
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

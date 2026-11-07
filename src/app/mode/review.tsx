import { router, useLocalSearchParams } from 'expo-router'
import { useAtom, useAtomValue } from 'jotai'
import { useEffect, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { AnswerState } from '@/types/drill'
import type { DeckWord } from '@/types/word'

import { activeBucketAtom, hudPageAtom, hudRoundAtom, studyDrillAtom } from '@/atoms/settings'
import { getDrill } from '@/components/drill/drills'
import { ScreenHeader } from '@/components/header'
import { WordDeck, type WordDeckHandle } from '@/components/word-deck'
import {
  countedReviewCount,
  finishReview,
  getProgress,
  getWordsCompletedOn,
  getWordsFlaggedOn,
  getWordsWithRoundFlag,
  openReviewSession,
  recordAnswer,
  settleReview,
  setRoundFlag,
  type ReviewSessionRow,
} from '@/db/repo'
import { todayLocalDate } from '@/lib/date'
import { formatDayLabel } from '@/lib/format'
import { speakWord } from '@/lib/speech'
import { useStudyUsage } from '@/lib/use-study-usage'

type RoundWalk = {
  kind: 'round'
  session: ReviewSessionRow
  queue: DeckWord[]
  countedCount: number
  startIndex: number
}
type DayWalk = {
  kind: 'day'
  day: string
  /** One entry per (round, position) walked that day — a word re-studied in
   * a later round appears again, deliberately without dedup. */
  queue: (DeckWord & { bucketId: string; round: number })[]
  startIndex: number
}
type Walk = RoundWalk | DayWalk

type ReviewState = {
  walk: Walk
  seen: number
  answers: Record<string, AnswerState>
  drafts: Record<string, string>
}

/** The enriched queue entries date walks carry; round walks pass plain
 * DeckWords without them. */
type DayEntry = DeckWord & { bucketId?: string; round?: number }

/** Flips one word's flag inside the walk queue. The branch is not noise: it
 * keeps each walk kind's queue element type exact (the date walk's words
 * carry bucketId, which a union-wide map would infer away). Date walks
 * match on bucket + round + position — positions collide across buckets,
 * and the same word may be flagged in several rounds of one day. */
function withQueueFlag(state: ReviewState, word: DayEntry, flagged: boolean): ReviewState {
  const { walk } = state
  const same = (w: DayEntry): boolean =>
    w.position === word.position &&
    (word.bucketId === undefined || (w.bucketId === word.bucketId && w.round === word.round))
  if (walk.kind === 'round') {
    const queue = walk.queue.map((w) => (same(w) ? { ...w, flagged } : w))
    return { ...state, walk: { ...walk, queue } }
  }
  const queue = walk.queue.map((w) => (same(w) ? { ...w, flagged } : w))
  return { ...state, walk: { ...walk, queue } }
}

export default function ReviewScreen() {
  const params = useLocalSearchParams<{
    bucket?: string
    round?: string
    day?: string
    flagDay?: string
  }>()
  const activeName = useAtomValue(activeBucketAtom)
  const bucketName = typeof params.bucket === 'string' && params.bucket ? params.bucket : activeName
  const [studyDrill] = useAtom(studyDrillAtom)
  const drill = getDrill(studyDrill)
  const showPage = useAtomValue(hudPageAtom)
  const showRound = useAtomValue(hudRoundAtom)

  const [loaded, setLoaded] = useState<ReviewState | null>(null)
  const [empty, setEmpty] = useState(false)
  const deckRef = useRef<WordDeckHandle>(null)
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoaded(null)
    setEmpty(false)
    void (async () => {
      // Date walks replay a date across buckets and rounds: params.day walks
      // what was studied, params.flagDay what was flagged. Without either,
      // the walk is one round's flag list.
      const flagDay = typeof params.flagDay === 'string' && params.flagDay ? params.flagDay : ''
      const studyDay = typeof params.day === 'string' && params.day ? params.day : ''
      if (flagDay || studyDay) {
        const queue = flagDay
          ? await getWordsFlaggedOn(flagDay)
          : await getWordsCompletedOn(studyDay)
        if (cancelled) return
        if (queue.length === 0) {
          setEmpty(true)
          return
        }
        drill.prepare?.(queue)
        if (!cancelled) {
          setLoaded({
            walk: { kind: 'day', day: flagDay || studyDay, queue, startIndex: 0 },
            seen: 1,
            answers: {},
            drafts: {},
          })
        }
        return
      }
      const requested = Number(params.round)
      const round =
        Number.isInteger(requested) && requested > 0
          ? requested
          : (await getProgress(bucketName)).round
      const reviewSession = await openReviewSession(bucketName, round)
      if (cancelled) return
      if (!reviewSession) {
        setEmpty(true)
        return
      }
      const words = await getWordsWithRoundFlag(bucketName, round)
      const byPosition = new Map(words.map((word) => [word.position, word]))
      const queue: DeckWord[] = reviewSession.queue.flatMap((position) => {
        const word = byPosition.get(position)
        return word ? [word] : []
      })
      const countedCount = reviewSession.counted
        ? (reviewSession.number ?? 1) - 1
        : await countedReviewCount(bucketName, round)
      const rawStart = queue.findIndex((word) => word.position >= reviewSession.lastPosition)
      const startIndex = rawStart < 0 ? 0 : rawStart
      drill.prepare?.(words)
      if (!cancelled) {
        setLoaded({
          walk: {
            kind: 'round',
            session: reviewSession,
            queue,
            countedCount,
            startIndex,
          },
          seen: startIndex + 1,
          answers: {},
          drafts: {},
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bucketName, params.round, params.day, params.flagDay, drill])

  if (empty) {
    return (
      <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
        <ScreenHeader title="Review" onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-400 dark:text-gray-500 text-[17px]">
            {typeof params.flagDay === 'string' && params.flagDay
              ? 'Nothing flagged on this day'
              : typeof params.day === 'string' && params.day
                ? 'Nothing studied on this day'
                : 'Nothing flagged yet'}
          </Text>
        </View>
      </SafeAreaView>
    )
  }
  if (!loaded) {
    return <View className="bg-white dark:bg-black flex-1" />
  }

  const { walk, seen, answers, drafts } = loaded
  const roundWalk = walk.kind === 'round' ? walk : undefined
  const countedCount = roundWalk ? roundWalk.countedCount : undefined
  const answerKeyOf = (word: DeckWord & { bucketId?: string; round?: number }): string =>
    walk.kind === 'day' ? `${word.bucketId}:${word.round}:${word.position}` : `${word.position}`
  const timeLabel = roundWalk
    ? roundWalk.session.counted
      ? `time ${roundWalk.session.number}`
      : `time ${roundWalk.countedCount + 1} · uncounted`
    : undefined
  // The day replay's title follows the card on screen: crossing from one
  // round's words into the next advances the stamped round with it.
  const titleRound =
    walk.kind === 'round'
      ? walk.session.round
      : walk.queue[Math.min(seen, walk.queue.length) - 1].round
  const hudTextClass = 'text-[13px] text-gray-400 dark:text-gray-500'

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      <WordDeck
        words={walk.queue}
        resetKey={`${bucketName}:${walk.kind}:${walk.kind === 'round' ? walk.session.id : walk.day}`}
        initialIndex={walk.startIndex}
        onSpeak={(word) => speakWord(word.word)}
        renderCard={(word: DeckWord, helpers) =>
          drill.renderCard({
            word,
            answered: answers[answerKeyOf(word)],
            onAnswer: (correct, picked) => {
              setLoaded((prev) =>
                prev
                  ? {
                      ...prev,
                      answers: {
                        ...prev.answers,
                        [answerKeyOf(word)]: { correct, picked },
                      },
                    }
                  : prev,
              )
              void recordAnswer({
                bucketId: bucketName,
                // The queue entry carries the round it was walked in; a
                // plain DeckWord (round walk) does not, hence the cast.
                round:
                  walk.kind === 'round'
                    ? walk.session.round
                    : ((word as DeckWord & { round?: number }).round ?? 0),
                position: word.position,
                mode: drill.id,
                correct,
              })
              // Wrong picks auto-flag when the drill says so — the bookmark is
              // the undo. Round walks queue from flags already, so this only
              // lands on day replays (or a word unflagged mid-walk).
              if (!correct && drill.autoFlagOnWrong && !word.flagged) {
                setLoaded((prev) => (prev ? withQueueFlag(prev, word, true) : prev))
                void setRoundFlag(
                  bucketName,
                  walk.kind === 'round' ? walk.session.round : 0,
                  word.position,
                  true,
                )
              }
              if (correct && drill.autoAdvanceMs) {
                if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current)
                autoAdvanceTimer.current = setTimeout(() => {
                  if (deckRef.current?.showsWord(word.position)) deckRef.current.advance()
                }, drill.autoAdvanceMs)
              }
            },
            onSkip: () =>
              setLoaded((prev) =>
                prev
                  ? {
                      ...prev,
                      answers: { ...prev.answers, [answerKeyOf(word)]: { skipped: true } },
                    }
                  : prev,
              ),
            draft: drafts[answerKeyOf(word)] ?? '',
            onDraft: (value) =>
              setLoaded((prev) =>
                prev ? { ...prev, drafts: { ...prev.drafts, [answerKeyOf(word)]: value } } : prev,
              ),
            onReplay: helpers.onReplay,
            onToggleFlag: () => {
              const flagged = !word.flagged
              setLoaded((prev) => (prev ? withQueueFlag(prev, word, flagged) : prev))
              void setRoundFlag(
                walk.kind === 'round' ? bucketName : ((word as DayEntry).bucketId ?? bucketName),
                walk.kind === 'round' ? walk.session.round : ((word as DayEntry).round ?? 0),
                word.position,
                flagged,
              )
            },
          })
        }
        canSettle={(from, to) => {
          if (drill.scrollable) return true
          const fromWord = walk.queue[from]
          if (!fromWord) return true
          return answers[answerKeyOf(fromWord)] !== undefined
        }}
        onSettle={(word, index) => {
          if (walk.kind === 'round') void settleReview(walk.session.id, word.position)
          setLoaded((prev) => (prev ? { ...prev, seen: index + 1 } : prev))
        }}
        onScrub={(index) => {
          setLoaded((prev) => (prev ? { ...prev, seen: index + 1 } : prev))
        }}
        onClose={() => router.back()}
        onSearch={() => router.push({ pathname: '/mode/search', params: { bucket: bucketName } })}
        scrubbable={drill.scrubbable}
        autoSpeak={drill.speakOnSettle}
        headerCenter={
          <Text className="font-semibold text-gray-500 dark:text-gray-400 text-[13px]">
            {/* Round reviews stamp today (the walk happens now); day replays
                stamp the day they replay, and the round follows the card on
                screen — the replay walks the day round by round. */}
            {`Review(${drill.label}) ${walk.kind === 'round' ? todayLocalDate() : walk.day} ${bucketName}`}
            {` ${titleRound}`}
          </Text>
        }
        hudLeft={showRound ? <Text className={hudTextClass}>{timeLabel}</Text> : undefined}
        hudRight={
          showPage ? (
            <Text className={hudTextClass} style={{ fontVariant: ['tabular-nums'] }}>
              {Math.min(seen, walk.queue.length)}/{walk.queue.length}
            </Text>
          ) : undefined
        }
        end={{
          render: () => (
            <View className="gap-2 px-8 flex-1 items-center justify-center">
              <Text className="font-bold text-black dark:text-white text-center text-[28px]">
                Review complete
              </Text>
              <Text className="text-gray-400 dark:text-gray-500 text-center text-[17px]">
                {timeLabel}
              </Text>
            </View>
          ),
          onReached: () => {
            if (walk.kind === 'round') void finishReview(walk.session.id)
          },
          action: 'close',
        }}
      />
    </SafeAreaView>
  )
}

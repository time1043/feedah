import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useAtomValue } from 'jotai'
import { useCallback, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { DeckWord } from '@/types/bucket'

import { activeBucketAtom } from '@/atoms/bucket'
import { deckFooterAtom, deckHeaderAtom, deckProgressBarAtom, deckTitleAtom } from '@/atoms/deck'
import {
  autoSpeakAtom,
  speechRateAtom,
  speechRateReadyAtom,
  tapToRevealAtom,
} from '@/atoms/settings'
import { ScreenHeader } from '@/components/header'
import { WordDeck, type WordDeckHandle } from '@/components/word-deck'
import { getWordsCompletedOn, getWordsFlaggedOn, type DayWord } from '@/db/repo/day-walk'
import {
  countedReviewCount,
  finishReview,
  openReviewSession,
  settleReview,
  type ReviewSessionRow,
} from '@/db/repo/review-session'
import { getProgress, getWordsWithRoundFlag, setRoundFlag } from '@/db/repo/study-round'
import { goBack } from '@/lib/back'
import { formatDayLabel } from '@/lib/format'
import { speakWord } from '@/lib/speech'
import { useStudyUsage } from '@/lib/use-study-usage'

/** One round's review in flight: the session row it resumes, the snapshot's
 * positions joined onto the live words, and where the HUD's time label
 * counts from. */
type RoundWalk = {
  kind: 'round'
  session: ReviewSessionRow
  queue: DeckWord[]
  round: number
  countedCount: number
  startIndex: number
}

/** A date walk in flight: the day replay or the flag replay. One entry per
 * (bucket, round, position) — a word walked in two rounds appears twice,
 * deliberately without dedup; the entries carry their bucket and round
 * because a date walk spans buckets (positions collide). */
type DayWalk = {
  kind: 'day' | 'flagDay'
  day: string
  queue: DayWord[]
}

type Walk = RoundWalk | DayWalk

/**
 * The review screen: a flag list or a date, walked card by card.
 *
 * Three walks share one deck:
 *  - the round walk — one round's flag list, opened by the round list or
 *    the home entry. The session under it: while the round's feed is
 *    unfinished the review is a draft (resumable, HUD reads time n+1 ·
 *    uncounted); once the feed completes, the next entry discards the draft
 *    and opens the real `time {n}` from the current flag list. Reaching the
 *    end archives a counted session; a finished draft leaves no trace.
 *  - the day replay and the flag replay — opened from the statistics tab;
 *    they carry no session and record nothing but their flag toggles.
 *
 * Every walk also owns a browsing layer: scrubbing away floats the Resume
 * reviewing pill, and a browse-mode landing records nothing — the watermark
 * (round walks) and the frontier stay where the walk actually was.
 *
 * The screen keeps two concerns apart on purpose: the walk owns the queue
 * and the cursor (and stays answer-free), while the card and the answer
 * policy are the drill layer's — when the drill registry lands, its card
 * plugs into this deck without reshaping the walks.
 */
export default function ReviewScreen() {
  const params = useLocalSearchParams<{
    bucket?: string
    round?: string
    day?: string
    flagDay?: string
  }>()
  const activeName = useAtomValue(activeBucketAtom)
  const bucketName = typeof params.bucket === 'string' && params.bucket ? params.bucket : activeName

  const speechRate = useAtomValue(speechRateAtom)
  const speechRateReady = useAtomValue(speechRateReadyAtom)
  const autoSpeak = useAtomValue(autoSpeakAtom)
  const tapToReveal = useAtomValue(tapToRevealAtom)
  const showHeader = useAtomValue(deckHeaderAtom)
  const showTitle = useAtomValue(deckTitleAtom)
  const showProgressBar = useAtomValue(deckProgressBarAtom)
  const showFooter = useAtomValue(deckFooterAtom)
  // The deck decides when to speak (open, settle, replay taps); the screen
  // decides how and whether — the stored rate, once its hydration has
  // settled and auto-speak is on.
  const canSpeak = speechRateReady && autoSpeak

  // null = the walk has not loaded yet; `empty` is a real answer (no flags
  // in this round, nothing on that day) and shows the empty state instead.
  const [walk, setWalk] = useState<Walk | null>(null)
  const [empty, setEmpty] = useState(false)
  const [seen, setSeen] = useState(1)
  // Review decks count toward the daily "studying" metric too.
  useStudyUsage()

  const deckRef = useRef<WordDeckHandle>(null)
  // Free-swiping state entered by scrubbing; exited by Resume reviewing.
  // The frontier is the farthest card index reached in the current walk.
  const [frontier, setFrontier] = useState(0)
  const [browsing, setBrowsing] = useState(false)

  // Reloads on every focus: re-entry resumes the open session at its
  // watermark, and flags made (or cleared) elsewhere while this screen sat
  // under another one must show on return.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      setWalk(null)
      setEmpty(false)
      setSeen(1)
      setFrontier(0)
      setBrowsing(false)
      void (async () => {
        try {
          // Date walks replay a date across buckets and rounds: params.day
          // walks what was studied, params.flagDay what was flagged.
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
            if (!cancelled) {
              setWalk({ kind: flagDay ? 'flagDay' : 'day', day: flagDay || studyDay, queue })
            }
            return
          }

          // A pinned round arrives as a param; the home entry walks the
          // bucket's live round.
          const requested = Number(Array.isArray(params.round) ? params.round[0] : params.round)
          const resolved =
            Number.isInteger(requested) && requested > 0
              ? requested
              : (await getProgress(bucketName)).round
          // The session opens first: its queue snapshot freezes the walk,
          // and a null means this round has no flags at all.
          const session = await openReviewSession(bucketName, resolved)
          if (cancelled) return
          if (!session) {
            setEmpty(true)
            return
          }
          const [, words] = await getWordsWithRoundFlag(bucketName, resolved)
          // The snapshot's positions joined onto the live words: a word
          // whose row vanished (a re-seed) drops out instead of crashing
          // the deck, and the flag state is what the table says now.
          const byPosition = new Map(words.map((word) => [word.position, word]))
          const queue: DeckWord[] = session.queue.flatMap((position) => {
            const word = byPosition.get(position)
            return word ? [word] : []
          })
          if (cancelled) return
          if (queue.length === 0) {
            // Every flagged word vanished since the snapshot (a re-seed, or
            // the marks cleared elsewhere): the walk cannot load again, so
            // the session finishes here instead of lingering open forever.
            await finishReview(session.id)
            // The await re-opens the cancelled window: a refocus that raced
            // this write must not inherit this walk's empty answer.
            if (cancelled) return
            setEmpty(true)
            return
          }
          // A draft's HUD reads T{n+1} · uncounted; a counted session
          // carries its own number.
          const countedCount = session.counted
            ? (session.number ?? 1) - 1
            : await countedReviewCount(bucketName, resolved)
          // Resume at the first snapshot word the walk has not passed yet;
          // the hud opens on that card, not one frame behind the deck's
          // first mirror. The frontier opens there too — the deck fires no
          // settle for its programmatic opening jump, so a scrub before the
          // first swipe must resume to the watermark, not to card 0.
          const rawStart = queue.findIndex((word) => word.position >= session.lastPosition)
          const start = rawStart < 0 ? 0 : rawStart
          if (cancelled) return
          setSeen(start + 1)
          setFrontier(start)
          setWalk({
            kind: 'round',
            session,
            queue,
            round: resolved,
            countedCount,
            startIndex: start,
          })
        } catch (error) {
          console.error('[review] load failed', error)
        }
      })()
      return () => {
        cancelled = true
      }
    }, [bucketName, params.round, params.day, params.flagDay]),
  )

  if (walk === null) {
    return <View className="bg-white dark:bg-black flex-1" />
  }

  // The empty answer renders before the walk guard: an emptied queue
  // leaves the walk null too, and the blank screen would hide it forever.
  const emptyCopy =
    params.flagDay && typeof params.flagDay === 'string' && params.flagDay
      ? 'Nothing flagged on this day'
      : params.day && typeof params.day === 'string' && params.day
        ? 'Nothing studied on this day'
        : 'Nothing flagged yet'
  if (empty) {
    return (
      <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
        <ScreenHeader title="Review" onBack={goBack} onSearch={() => router.push('/mode/search')} />
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-400 dark:text-gray-500 text-[17px]">{emptyCopy}</Text>
        </View>
      </SafeAreaView>
    )
  }

  /** Flips one word's flag inside the walk queue. The branch is not noise:
   * it keeps each walk kind's queue element type exact AND its match exact —
   * the round walk matches on position alone (positions are unique within
   * one bucket's deck), while the date walk matches on bucket + round +
   * position: positions collide across buckets and rounds, and flagging one
   * copy of a word must not flip the other copies the same day replays. */
  const withQueueFlag = (state: Walk, word: DeckWord, flagged: boolean): Walk => {
    if (state.kind === 'round') {
      return {
        ...state,
        queue: state.queue.map((entry) =>
          entry.position === word.position ? { ...entry, flagged } : entry,
        ),
      }
    }
    const tapped = word as DayWord
    return {
      ...state,
      queue: state.queue.map((entry) =>
        entry.position === tapped.position &&
        entry.bucketName === tapped.bucketName &&
        entry.round === tapped.round
          ? { ...entry, flagged }
          : entry,
      ),
    }
  }

  /** The bookmark is the walk's undo: a word that sticks gets its flag
   * cleared right here. The queue keeps the word in the walk — the list was
   * frozen when the walk opened, and unflagging must not reshuffle the
   * cards under the reader's thumb. The session flip and the round_flag row
   * say the same thing; date walks write the entry's own bucket and round
   * (they span buckets, where positions collide). */
  const toggleFlag = (word: DeckWord) => {
    setWalk((prev) => (prev ? withQueueFlag(prev, word, !word.flagged) : null))
    const entry = word as DeckWord & { bucketName?: string; round?: number }
    const target =
      walk.kind === 'round'
        ? { bucketName, round: walk.session.round }
        : { bucketName: entry.bucketName ?? bucketName, round: entry.round ?? 0 }
    void setRoundFlag(target.bucketName, target.round, word.position, !word.flagged).catch(
      (error) => console.error('[review] flag write failed', error),
    )
  }

  const { queue } = walk
  const timeLabel =
    walk.kind === 'round'
      ? walk.session.counted
        ? `T${walk.session.number}`
        : `T${walk.countedCount + 1} · uncounted`
      : undefined

  const resumeReviewing = () => {
    setBrowsing(false)
    deckRef.current?.scrollTo(frontier)
  }

  // The date walk's title follows the card on screen: crossing from one
  // round's words into the next advances the stamped round with it.
  const titleRound =
    walk.kind === 'round'
      ? walk.round
      : (walk.queue[Math.min(seen, walk.queue.length) - 1]?.round ?? 1)
  const title =
    walk.kind === 'round'
      ? `Review ${bucketName} R${walk.round}`
      : `Review ${formatDayLabel(walk.day)}${walk.kind === 'flagDay' ? ' flags' : ''} · R${titleRound}`

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      {showHeader && (
        <ScreenHeader
          title={showTitle ? title : undefined}
          onBack={goBack}
          onSearch={() => router.push('/mode/search')}
        />
      )}
      <WordDeck
        ref={deckRef}
        words={queue}
        resetKey={walk.kind === 'round' ? `round:${walk.session.id}` : `${walk.kind}:${walk.day}`}
        initialIndex={walk.kind === 'round' ? walk.startIndex : 0}
        progressBar={showProgressBar}
        tapToReveal={tapToReveal}
        canSpeak={canSpeak}
        onSpeak={(word) => speakWord(word.word, speechRate)}
        onToggleFlag={toggleFlag}
        onIndexChange={(index) => setSeen(index + 1)}
        // Every settled landing advances the resume watermark on forward
        // settles unless browsing — a round walk left half-way picks up at
        // the first card it has not passed. Date walks carry no session and
        // record nothing; the frontier moves for every walk kind.
        onSettle={(word, index) => {
          if (!browsing && index > frontier) {
            setFrontier(index)
            if (walk.kind === 'round') {
              void settleReview(walk.session.id, word.position).catch((error) =>
                console.error('[review] watermark write failed', error),
              )
            }
          }
        }}
        // Scrubbing enters browse mode: the pill floats over the cards — not
        // the header, which settings can hide — and is the way back to the
        // walk's frontier.
        onScrub={() => setBrowsing(true)}
        banner={
          browsing ? (
            <Pressable
              className="bg-accent px-4 py-1.5 rounded-full"
              onPress={resumeReviewing}
              accessibilityRole="button"
              accessibilityLabel="Resume reviewing"
            >
              <Text className="font-semibold text-black text-[13px]">Resume reviewing</Text>
            </Pressable>
          ) : undefined
        }
        onClose={goBack}
        // The footer switch gates the bottom line: the session's time label
        // on the left, the pagination ordinal on the right.
        hudLeft={
          showFooter && timeLabel ? (
            <Text className="text-gray-400 dark:text-gray-500 text-[13px]">{timeLabel}</Text>
          ) : undefined
        }
        hudRight={
          showFooter ? (
            <Text
              className="text-gray-400 dark:text-gray-500 text-[13px]"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {Math.min(seen, queue.length)}/{queue.length}
            </Text>
          ) : undefined
        }
        end={{
          render: () => (
            <View className="gap-2 px-8 flex-1 items-center justify-center">
              <Text className="font-bold text-black dark:text-white text-center text-[28px]">
                Review complete
              </Text>
              {timeLabel && (
                <Text className="text-gray-400 dark:text-gray-500 text-center text-[17px]">
                  {timeLabel}
                </Text>
              )}
            </View>
          ),
          // The end card archives the session: a counted walk keeps its
          // finish time, a draft deletes itself (unfinished-feed reviews
          // leave no trace). Date walks have no session to close. Browsing
          // vetoes the landing — finishing a walk you scrubbed through would
          // be a lie about having walked it.
          onReached: () => {
            if (browsing) return false
            if (walk.kind === 'round') {
              void finishReview(walk.session.id).catch((error) =>
                console.error('[review] finish write failed', error),
              )
            }
          },
          action: 'close',
        }}
      />
    </SafeAreaView>
  )
}

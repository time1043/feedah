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
import {
  countedReviewCount,
  finishReview,
  openReviewSession,
  settleReview,
  type ReviewSessionRow,
} from '@/db/repo/review-session'
import { getProgress, getWordsWithRoundFlag, setRoundFlag } from '@/db/repo/study-round'
import { goBack } from '@/lib/back'
import { speakWord } from '@/lib/speech'

/** One review walk in flight: the session row it resumes, the snapshot's
 * positions joined onto the live words, and where the HUD's time label
 * counts from. */
type Walk = {
  session: ReviewSessionRow
  queue: DeckWord[]
  round: number
  countedCount: number
  startIndex: number
}

/**
 * The review screen: one round's flag list, walked card by card — the marks
 * a study round left, revisited on purpose. The round list opens a pinned
 * round; the home entry reviews the active bucket's live one.
 *
 * The session under the walk: while the round's feed is unfinished the
 * review is a draft (resumable, HUD reads time n+1 · uncounted); once the
 * feed completes, the next entry discards the draft and opens the real
 * `time {n}` from the current flag list. Reaching the end archives a counted
 * session; a finished draft leaves no trace.
 *
 * The screen keeps two concerns apart on purpose: the walk owns the queue
 * and the cursor (and stays answer-free), while the card and the answer
 * policy are the drill layer's — when the drill registry lands, its card
 * plugs into this deck without reshaping the walk.
 */
export default function ReviewScreen() {
  const params = useLocalSearchParams<{ bucket?: string; round?: string }>()
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
  // in this round) and shows the empty state instead.
  const [walk, setWalk] = useState<Walk | null>(null)
  const [empty, setEmpty] = useState(false)
  const [seen, setSeen] = useState(1)

  const deckRef = useRef<WordDeckHandle>(null)
  // Free-swiping state entered by scrubbing; exited by Resume reviewing.
  // The frontier is the farthest card index reached in the current walk.
  const [frontier, setFrontier] = useState(0)
  const [browsing, setBrowsing] = useState(false)

  // Reloads on every focus: re-entry resumes the open session at its
  // watermark, and flags made (or cleared) in browse or study while this
  // screen sat under another one must show on return.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      setWalk(null)
      setEmpty(false)
      setBrowsing(false)
      void (async () => {
        try {
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
          // A draft's HUD reads time {n+1} · uncounted; a counted session
          // carries its own number.
          const countedCount = session.counted
            ? (session.number ?? 1) - 1
            : await countedReviewCount(bucketName, resolved)
          // Resume at the first snapshot word the walk has not passed yet;
          // the hud opens on that card, not one frame behind the deck's
          // first mirror.
          const rawStart = queue.findIndex((word) => word.position >= session.lastPosition)
          const start = rawStart < 0 ? 0 : rawStart
          if (cancelled) return
          setSeen(start + 1)
          setFrontier(start)
          setWalk({ session, queue, round: resolved, countedCount, startIndex: start })
        } catch (error) {
          console.error('[review] load failed', error)
        }
      })()
      return () => {
        cancelled = true
      }
    }, [bucketName, params.round]),
  )

  // The empty answer renders before the loading guard: an emptied queue
  // leaves the walk null too, and the blank screen would hide it forever.
  if (empty) {
    return (
      <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
        <ScreenHeader title="Review" onBack={goBack} onSearch={() => router.push('/mode/search')} />
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-400 dark:text-gray-500 text-[17px]">Nothing flagged yet</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (walk === null) {
    return <View className="bg-white dark:bg-black flex-1" />
  }

  /** The bookmark is the walk's undo: a word that sticks gets its flag
   * cleared right here. The queue keeps the word in the walk — the list was
   * frozen when the session opened, and unflagging must not reshuffle the
   * cards under the reader's thumb. The session flip and the round_flag row
   * say the same thing, like the study deck's bookmark does. */
  const toggleFlag = (word: DeckWord) => {
    setWalk(
      (prev) =>
        prev && {
          ...prev,
          queue: prev.queue.map((entry) =>
            entry.position === word.position ? { ...entry, flagged: !entry.flagged } : entry,
          ),
        },
    )
    void setRoundFlag(bucketName, walk.round, word.position, !word.flagged).catch((error) =>
      console.error('[review] flag write failed', error),
    )
  }

  const resumeReviewing = () => {
    setBrowsing(false)
    deckRef.current?.scrollTo(frontier)
  }

  const { session, queue, round, countedCount, startIndex } = walk
  const timeLabel = session.counted ? `T${session.number}` : `T${countedCount + 1} · uncounted`

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      {showHeader && (
        <ScreenHeader
          title={showTitle ? `Review ${bucketName}` : undefined}
          onBack={goBack}
          onSearch={() => router.push('/mode/search')}
        />
      )}
      <WordDeck
        ref={deckRef}
        words={queue}
        initialIndex={startIndex}
        progressBar={showProgressBar}
        tapToReveal={tapToReveal}
        canSpeak={canSpeak}
        onSpeak={(word) => speakWord(word.word, speechRate)}
        onToggleFlag={toggleFlag}
        onIndexChange={(index) => setSeen(index + 1)}
        // Advances the resume watermark on forward settles unless browsing:
        // a walk left half-way picks up at the first card it has not passed.
        onSettle={(word, index) => {
          if (!browsing && index > frontier) {
            setFrontier(index)
            void settleReview(session.id, word.position).catch((error) =>
              console.error('[review] watermark write failed', error),
            )
          }
        }}
        // Scrubbing enters browse mode: the pill floats over the cards — not
        // the header, which settings can hide — and is the way back to the
        // walk's frontier.
        onScrub={() => setBrowsing(true)}
        banner={
          browsing ? (
            <Pressable
              className="bg-blue-500 px-4 py-1.5 rounded-full"
              onPress={resumeReviewing}
              accessibilityRole="button"
              accessibilityLabel="Resume reviewing"
            >
              <Text className="font-semibold text-white text-[13px]">Resume reviewing</Text>
            </Pressable>
          ) : undefined
        }
        onClose={goBack}
        // The footer switch gates the bottom line: the session's time label
        // on the left, the pagination ordinal on the right.
        hudLeft={
          showFooter ? (
            <Text className="text-gray-400 dark:text-gray-500 text-[13px]">
              R{round} {timeLabel}
            </Text>
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
              <Text className="text-gray-400 dark:text-gray-500 text-center text-[17px]">
                {timeLabel}
              </Text>
            </View>
          ),
          // The end card archives the session: a counted walk keeps its
          // finish time, a draft deletes itself (unfinished-feed reviews
          // leave no trace). Reaching the end while browsing snaps back to
          // the last word instead of closing the review walk.
          onReached: () => {
            if (browsing) return false
            void finishReview(session.id).catch((error) =>
              console.error('[review] finish write failed', error),
            )
          },
          action: 'close',
        }}
      />
    </SafeAreaView>
  )
}

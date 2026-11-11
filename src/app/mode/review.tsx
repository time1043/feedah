import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useAtomValue } from 'jotai'
import { useCallback, useState } from 'react'
import { Text, View } from 'react-native'
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
import { WordDeck } from '@/components/word-deck'
import { getProgress, getWordsWithRoundFlag } from '@/db/repo/study-round'
import { goBack } from '@/lib/back'
import { speakWord } from '@/lib/speech'

/**
 * The review screen: one round's flag list, walked card by card — the marks
 * a study round left, revisited on purpose. The round list opens a pinned
 * round; the home entry reviews the active bucket's live one.
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

  // null = the queue has not answered yet; an empty array is a real answer
  // (no flags in this round) and flashes the empty state.
  const [queue, setQueue] = useState<DeckWord[] | null>(null)
  const [round, setRound] = useState<number | null>(null)
  const [seen, setSeen] = useState(1)

  // Reloads on every focus: flags made (or cleared) in browse or study while
  // this screen sat under another one must show on return.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      setQueue(null)
      setRound(null)
      void (async () => {
        try {
          // A pinned round arrives as a param; the home entry walks the
          // bucket's live round.
          const requested = Number(Array.isArray(params.round) ? params.round[0] : params.round)
          const resolved =
            Number.isInteger(requested) && requested > 0
              ? requested
              : (await getProgress(bucketName)).round
          const [, words] = await getWordsWithRoundFlag(bucketName, resolved)
          if (!cancelled) {
            setRound(resolved)
            setQueue(words.filter((entry) => entry.flagged))
          }
        } catch (error) {
          console.error('[review] load failed', error)
        }
      })()
      return () => {
        cancelled = true
      }
    }, [bucketName, params.round]),
  )

  /** The bookmark is the walk's undo: a word that sticks gets its flag
   * cleared right here. The queue keeps the word in the walk — the list was
   * frozen when the screen opened, and unflagging must not reshuffle the
   * cards under the reader's thumb. */
  const toggleFlag = (word: DeckWord) => {
    setQueue(
      (prev) =>
        prev?.map((entry) =>
          entry.position === word.position ? { ...entry, flagged: !entry.flagged } : entry,
        ) ?? null,
    )
  }

  if (queue === null) {
    return <View className="bg-white dark:bg-black flex-1" />
  }

  if (queue.length === 0) {
    return (
      <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
        <ScreenHeader title="Review" onBack={goBack} onSearch={() => router.push('/mode/search')} />
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-400 dark:text-gray-500 text-[17px]">Nothing flagged yet</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      {showHeader && (
        <ScreenHeader
          title={showTitle && round !== null ? `Review ${bucketName}` : undefined}
          onBack={goBack}
          onSearch={() => router.push('/mode/search')}
        />
      )}
      <WordDeck
        words={queue}
        initialIndex={0}
        progressBar={showProgressBar}
        tapToReveal={tapToReveal}
        canSpeak={canSpeak}
        onSpeak={(word) => speakWord(word.word, speechRate)}
        onToggleFlag={toggleFlag}
        onIndexChange={(index) => setSeen(index + 1)}
        onClose={goBack}
        // The footer switch gates both ends of the bottom line: the round on
        // the left and the page counter on the right.
        hudLeft={
          showFooter ? (
            <Text
              className="text-gray-400 dark:text-gray-500 text-[13px]"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              R{round}
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
            </View>
          ),
          action: 'close',
        }}
      />
    </SafeAreaView>
  )
}

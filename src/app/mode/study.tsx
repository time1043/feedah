import { router } from 'expo-router'
import { useAtomValue } from 'jotai'
import { useRef } from 'react'
import { Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

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
import { goBack } from '@/lib/back'
import { speakWord } from '@/lib/speech'
import { countsOf, frontierOf } from '@/lib/study-session'
import { useStudySession } from '@/lib/use-study-session'
import { findBucketByName } from '@/mock/bucket'

/** The study screen: swipe through the bucket's words, one full-screen card
 * at a time, driven by the study session. */
export default function StudyScreen() {
  const bucketName = useAtomValue(activeBucketAtom)
  const speechRate = useAtomValue(speechRateAtom)
  const speechRateReady = useAtomValue(speechRateReadyAtom)
  const autoSpeak = useAtomValue(autoSpeakAtom)
  const tapToReveal = useAtomValue(tapToRevealAtom)
  const showHeader = useAtomValue(deckHeaderAtom)
  const showTitle = useAtomValue(deckTitleAtom)
  const showProgressBar = useAtomValue(deckProgressBarAtom)
  const showFooter = useAtomValue(deckFooterAtom)
  const { session, actions } = useStudySession(bucketName)
  const deckRef = useRef<WordDeckHandle>(null)
  // The deck decides when to speak (open, settle, replay taps); the screen
  // decides how and whether — the stored rate, once its hydration has
  // settled and auto-speak is on.
  const canSpeak = speechRateReady && autoSpeak

  if (session.status !== 'ready') {
    return <View className="bg-white dark:bg-black flex-1" />
  }

  const frontier = frontierOf(session)
  // The end page shows the frozen facts of the round that just completed;
  // live counts read 0 of 0 (roundAdvanced wipes the answers) and the live
  // round number is already the next one when the page first paints.
  const endFacts = session.endFacts ?? {
    ...countsOf(session),
    nextRound: session.progress.round + 1,
  }

  const resumeStudying = () => {
    actions.resume()
    deckRef.current?.scrollTo(frontier)
  }

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      {showHeader && (
        <ScreenHeader
          title={showTitle ? `Study ${bucketName}` : undefined}
          onBack={goBack}
          onSearch={() => router.push('/mode/search')}
        />
      )}
      <WordDeck
        ref={deckRef}
        words={session.words}
        initialIndex={frontier}
        progressBar={showProgressBar}
        tapToReveal={tapToReveal}
        canSpeak={canSpeak}
        onSpeak={(word) => speakWord(word.word, speechRate)}
        onSettle={actions.settle}
        onScrub={actions.startBrowsing}
        // Scrubbing opens browse mode: the pill floats over the cards — not
        // the header, which the settings can hide — and is the way back to
        // the probe.
        banner={
          session.browsing ? (
            <Pressable
              className="bg-blue-500 px-4 py-1.5 rounded-full"
              onPress={resumeStudying}
              accessibilityRole="button"
              accessibilityLabel="Resume studying"
            >
              <Text className="font-semibold text-white text-[13px]">Resume studying</Text>
            </Pressable>
          ) : undefined
        }
        hudRight={
          showFooter ? (
            <Text
              className="text-gray-400 dark:text-gray-500 text-[13px]"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {Math.min(session.progress.pointer + 1, session.words.length)}/{session.words.length}
            </Text>
          ) : undefined
        }
        end={{
          render: () => (
            <View className="gap-2 px-8 flex-1 items-center justify-center">
              <Text className="font-bold text-black dark:text-white text-center text-[28px]">
                Round complete
              </Text>
              <Text className="text-gray-400 dark:text-gray-500 text-center text-[17px]">
                Round {endFacts.nextRound} starts in a moment
              </Text>
            </View>
          ),
          // Reaching the end completes the round only when the probe has
          // actually walked the whole list outside browse mode; otherwise
          // the deck snaps back to the last word.
          onReached: () => actions.reachEnd(),
          action: 'reset',
        }}
      />
    </SafeAreaView>
  )
}

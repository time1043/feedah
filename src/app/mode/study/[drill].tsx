import { router, useLocalSearchParams } from 'expo-router'
import { useAtomValue } from 'jotai'
import { useEffect, useRef } from 'react'
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
import { getDrill } from '@/drills/registry'
import { goBack } from '@/lib/back'
import { speakWord } from '@/lib/speech'
import { countsOf, frontierOf } from '@/lib/study-session'
import { useStudySession } from '@/lib/use-study-session'

/**
 * The generalized study screen: chrome, deck wiring and the auto-advance
 * executor. Session state, the answer gate and policy db-writes live in
 * useStudySession; the drill contributes cards, payloads and copy. See
 * src/drills/contract.ts.
 */
export default function StudyScreen() {
  const params = useLocalSearchParams<{ drill?: string; bucket?: string }>()
  const drill = getDrill(typeof params.drill === 'string' ? params.drill : '')
  // The opener can pin a bucket (the bucket tab launches any of them);
  // otherwise the active one.
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
  // settled and auto-speak is on. The drill's speakOnSettle gates the
  // deck's own speaks on top of that.
  const canSpeak = speechRateReady && autoSpeak
  const { session, actions } = useStudySession(bucketName, drill)
  const deckRef = useRef<WordDeckHandle>(null)

  // Executes the reducer's auto-advance decision: slides to the pending
  // card when it is still on screen, then reports back. The countdown is
  // dueAt-based, so restarts on unrelated renders keep the schedule.
  useEffect(() => {
    const pending = session.status === 'ready' ? session.pendingAutoAdvance : null
    if (!pending) return
    const remaining = Math.max(0, pending.dueAt - Date.now())
    const timer = setTimeout(() => {
      if (deckRef.current?.showsWord(pending.position)) deckRef.current.advance()
      actions.autoAdvanceDone()
    }, remaining)
    return () => clearTimeout(timer)
  }, [session, actions])

  if (session.status !== 'ready') {
    return <View className="bg-white dark:bg-black flex-1" />
  }

  const { words, progress } = session
  const frontier = frontierOf(session)
  // The end page shows the frozen facts of the round that just completed;
  // live counts read 0 of 0 (roundAdvanced wipes the answers) and the live
  // round number is already the next one when the page first paints.
  const endFacts = session.endFacts ?? {
    ...countsOf(session),
    nextRound: progress.round + 1,
  }

  const resumeStudying = () => {
    actions.resume()
    deckRef.current?.scrollTo(frontier)
  }

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      {showHeader && (
        <ScreenHeader
          title={showTitle ? `Study(${drill.label}) ${bucketName}` : undefined}
          onBack={goBack}
          onSearch={() => router.push('/mode/search')}
        />
      )}
      <WordDeck
        ref={deckRef}
        words={session.words}
        resetKey={`${bucketName}:${drill.id}`}
        initialIndex={frontier}
        progressBar={showProgressBar}
        scrubbable={drill.scrubbable}
        autoSpeak={drill.speakOnSettle}
        tapToReveal={tapToReveal}
        canSpeak={canSpeak}
        onSpeak={(word) => speakWord(word.word, speechRate)}
        renderCard={(word: DeckWord, helpers) =>
          drill.renderCard({
            word,
            answered: session.answers[word.position],
            onAnswer: (correct, picked) => actions.answer(word, correct, picked),
            onSkip: () => actions.skip(word),
            draft: session.drafts[word.position] ?? '',
            onDraft: (value) => actions.draft(word, value),
            onReplay: helpers.onReplay,
            onToggleFlag: () => actions.toggleFlag(word),
            tapToReveal: helpers.tapToReveal,
          })
        }
        onSettle={(_, index) => actions.settle(index)}
        onScrub={actions.startBrowsing}
        onToggleFlag={actions.toggleFlag}
        // Browsing opens swiping; the end page stays reachable. Leaving an
        // unanswered card is the only thing the gate refuses.
        canSettle={(from, to) => {
          if (drill.scrollable || session.browsing) return true
          const fromWord = session.words[from]
          if (!fromWord) return true
          return to <= from || session.answers[fromWord.position] !== undefined
        }}
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
        // The footer line pairs the two: the probe's round on the left, the
        // pagination ordinal on the right. The footer switch gates the whole
        // bottom line.
        hudLeft={
          showFooter ? (
            <Text
              className="text-gray-400 dark:text-gray-500 text-[13px]"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              R{progress.round}
            </Text>
          ) : undefined
        }
        hudRight={
          showFooter ? (
            <Text
              className="text-gray-400 dark:text-gray-500 text-[13px]"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {Math.min(progress.pointer + 1, words.length)}/{words.length}
            </Text>
          ) : undefined
        }
        end={{
          render: () => {
            const copy = drill.endCopy({
              nextRound: endFacts.nextRound,
              total: words.length,
              correct: endFacts.correct,
              answered: endFacts.answered,
            })
            return (
              <View className="gap-2 px-8 flex-1 items-center justify-center">
                <Text className="font-bold text-black dark:text-white text-center text-[28px]">
                  {copy.title}
                </Text>
                {copy.stats && (
                  <Text className="text-gray-400 dark:text-gray-500 text-center text-[17px]">
                    {copy.stats}
                  </Text>
                )}
                <Text className="text-gray-400 dark:text-gray-500 text-center text-[17px]">
                  {copy.note}
                </Text>
              </View>
            )
          },
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

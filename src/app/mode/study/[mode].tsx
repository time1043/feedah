import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useAtomValue } from 'jotai'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { DeckWord } from '@/types/word'

import { activeBucketAtom, hudPageAtom, hudRoundAtom } from '@/atoms/settings'
import { WordDeck, type WordDeckHandle } from '@/components/word-deck'
import { speakWord } from '@/lib/speech'
import { useStudyUsage } from '@/lib/use-study-usage'
import { getStudyMode } from '@/study/modes'
import { countsOf, frontierOf } from '@/study/session'
import { useStudySession } from '@/study/use-study-session'

/**
 * The generalized study screen: chrome, deck wiring and the auto-advance
 * timer. Session state and policy db-writes live in useStudySession; the
 * mode contributes cards, payloads and copy. See src/study/types.ts.
 */
export default function StudyScreen() {
  const params = useLocalSearchParams<{ mode?: string }>()
  const mode = getStudyMode(typeof params.mode === 'string' ? params.mode : '')
  const bucketName = useAtomValue(activeBucketAtom)
  const showPage = useAtomValue(hudPageAtom)
  const showRound = useAtomValue(hudRoundAtom)
  const { session, payloads, actions } = useStudySession(bucketName, mode)
  const deckRef = useRef<WordDeckHandle>(null)
  // Pending auto-advance after a correct answer; cancelled on unmount.
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Mirrors the deck index so the auto-advance timer can check that the
  // answered card is still on screen when it fires.
  const deckIndexRef = useRef(0)
  // The deck's current card index, mirrored for the answer gate: quiz and
  // typing lock scrolling while the card on screen is unanswered.
  const [deckIndex, setDeckIndex] = useState(0)

  // A pending auto-advance must not fire after the screen is gone.
  useEffect(
    () => () => {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current)
    },
    [],
  )

  if (session.status !== 'ready') {
    return <View className="bg-white dark:bg-black flex-1" />
  }
  const { words, progress } = session
  const frontier = frontierOf(session)
  const { answered: answeredCount, correct: correctCount } = countsOf(session)

  const resumeStudying = () => {
    actions.resume()
    deckRef.current?.scrollTo(frontier)
  }

  const hudTextClass = 'text-[13px] text-gray-400 dark:text-gray-500'

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      <WordDeck
        ref={deckRef}
        words={session.words}
        resetKey={`${bucketName}:${mode.id}`}
        initialIndex={frontier}
        autoSpeak={mode.speakOnSettle}
        onSpeak={(word) => speakWord(word.word)}
        renderCard={(word: DeckWord, helpers) =>
          mode.renderCard({
            word,
            payload: payloads.get(word.position),
            answered: session.answers[word.position],
            onAnswer: (correct, picked) => {
              actions.answer(word, correct, picked)
              // A correct answer advances on its own — but only while the
              // answered card is still the one on screen.
              if (correct && mode.autoAdvanceMs) {
                if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current)
                autoAdvanceTimer.current = setTimeout(() => {
                  if (session.words[deckIndexRef.current]?.position === word.position) {
                    deckRef.current?.advance()
                  }
                }, mode.autoAdvanceMs)
              }
            },
            onSkip: () => actions.skip(word),
            draft: session.drafts[word.position] ?? '',
            onDraft: (value) => actions.draft(word, value),
            onReplay: helpers.onReplay,
            onToggleFlag: () => actions.toggleFlag(word),
          })
        }
        onSettle={(_, index) => actions.settle(index)}
        onScrub={actions.startBrowsing}
        onClose={() => router.back()}
        onIndexChange={(index) => {
          deckIndexRef.current = index
          setDeckIndex((prev) => (prev === index ? prev : index))
        }}
        scrubbable={mode.scrubbable}
        scrollEnabled={
          mode.scrollable ||
          session.browsing ||
          session.words[deckIndex] === undefined || // the end page stays reachable
          session.answers[session.words[deckIndex].position] !== undefined
        }
        headerCenter={
          session.browsing ? (
            <Pressable className="bg-blue-500 px-4 py-1.5 rounded-full" onPress={resumeStudying}>
              <Text className="font-semibold text-white text-[13px]">Resume studying</Text>
            </Pressable>
          ) : (
            <Text className="font-semibold text-gray-500 dark:text-gray-400 text-[13px]">
              {mode.label} · {bucketName}
            </Text>
          )
        }
        hudLeft={
          showRound ? <Text className={hudTextClass}>round {progress.round}</Text> : undefined
        }
        hudRight={
          showPage ? (
            <Text className={hudTextClass} style={{ fontVariant: ['tabular-nums'] }}>
              {progress.pointer}/{words.length}
            </Text>
          ) : undefined
        }
        onSearch={() => router.push({ pathname: '/mode/search', params: { bucket: bucketName } })}
        end={{
          render: () => {
            const copy = mode.endCopy({
              nextRound: progress.round + 1,
              total: words.length,
              correct: correctCount,
              answered: answeredCount,
            })
            return (
              <View className="gap-2 flex-1 items-center justify-center">
                <Text className="font-bold text-black dark:text-white text-[28px]">
                  {copy.title}
                </Text>
                <Text className="text-gray-400 dark:text-gray-500 text-[17px]">
                  {copy.subtitle}
                </Text>
              </View>
            )
          },
          onReached: () => actions.reachEnd(),
          action: 'reset',
        }}
      />
    </SafeAreaView>
  )
}

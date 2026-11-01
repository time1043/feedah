import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useAtomValue } from 'jotai'
import { useCallback, useEffect, useRef } from 'react'
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
 * executor. Session state, the answer gate and policy db-writes live in
 * useStudySession; the mode contributes cards, payloads and copy. See
 * src/study/types.ts.
 */
export default function StudyScreen() {
  const params = useLocalSearchParams<{ mode?: string }>()
  const mode = getStudyMode(typeof params.mode === 'string' ? params.mode : '')
  const bucketName = useAtomValue(activeBucketAtom)
  const showPage = useAtomValue(hudPageAtom)
  const showRound = useAtomValue(hudRoundAtom)
  const { session, actions } = useStudySession(bucketName, mode)
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
            answered: session.answers[word.position],
            onAnswer: (correct, picked) => actions.answer(word, correct, picked),
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
        canSettle={(from, to) => {
          // Browsing opens swiping; the end page stays reachable. Leaving an
          // unanswered card is the only thing the gate refuses.
          if (mode.scrollable || session.browsing) return true
          const fromWord = session.words[from]
          if (!fromWord) return true
          return to <= from || session.answers[fromWord.position] !== undefined
        }}
        scrubbable={mode.scrubbable}
        scrollEnabled={mode.scrollable || session.browsing}
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

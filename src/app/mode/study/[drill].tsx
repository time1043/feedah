import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useAtomValue } from 'jotai'
import { useCallback, useEffect, useRef } from 'react'
import { Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { DeckWord } from '@/types/word'

import {
  activeBucketAtom,
  deckProgressBarAtom,
  deckTitleAtom,
  hudPageAtom,
  hudRoundAtom,
} from '@/atoms/settings'
import { WordDeck, type WordDeckHandle } from '@/components/word-deck'
import { getDrill } from '@/drills/registry'
import { speakWord } from '@/lib/speech'
import { countsOf, frontierOf } from '@/lib/study-session'
import { useStudySession } from '@/lib/use-study-session'
import { useStudyUsage } from '@/lib/use-study-usage'

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
  const showPage = useAtomValue(hudPageAtom)
  const showRound = useAtomValue(hudRoundAtom)
  const showTitle = useAtomValue(deckTitleAtom)
  const showProgressBar = useAtomValue(deckProgressBarAtom)
  const { session, actions } = useStudySession(bucketName, drill)
  const deckRef = useRef<WordDeckHandle>(null)
  // Time on the deck accrues to the daily "studying" metric.
  useStudyUsage()

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
  // The end page shows the frozen facts of the round that just completed:
  // live counts read 0 of 0 (roundAdvanced wipes the answers) and the live
  // round number is already the next one when the page first paints.
  const endFacts = session.endFacts ?? { ...countsOf(session), nextRound: progress.round + 1 }

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
        resetKey={`${bucketName}:${drill.id}`}
        initialIndex={frontier}
        autoSpeak={drill.speakOnSettle}
        onSpeak={(word) => speakWord(word.word)}
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
          })
        }
        onSettle={(_, index) => actions.settle(index)}
        onScrub={actions.startBrowsing}
        onClose={() => router.back()}
        canSettle={(from, to) => {
          // Browsing opens swiping; the end page stays reachable. Leaving an
          // unanswered card is the only thing the gate refuses.
          if (drill.scrollable || session.browsing) return true
          const fromWord = session.words[from]
          if (!fromWord) return true
          return to <= from || session.answers[fromWord.position] !== undefined
        }}
        progressBar={showProgressBar}
        scrubbable={drill.scrubbable}
        headerCenter={
          session.browsing ? (
            <Pressable className="bg-blue-500 px-4 py-1.5 rounded-full" onPress={resumeStudying}>
              <Text className="font-semibold text-white text-[13px]">Resume studying</Text>
            </Pressable>
          ) : showTitle ? (
            <Text className="font-semibold text-gray-500 dark:text-gray-400 text-[13px]">
              Study({drill.label}) {bucketName}
            </Text>
          ) : undefined
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
          onReached: () => actions.reachEnd(),
          action: 'reset',
        }}
      />
    </SafeAreaView>
  )
}

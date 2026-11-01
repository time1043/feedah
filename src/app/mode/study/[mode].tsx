import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useAtomValue } from 'jotai'
import { useCallback, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { AnswerState } from '@/study/types'
import type { DeckWord } from '@/types/word'

import { activeBucketAtom, hudPageAtom, hudRoundAtom } from '@/atoms/settings'
import { WordDeck, type WordDeckHandle } from '@/components/word-deck'
import {
  completeRound,
  getProgress,
  getWordsWithRoundFlag,
  recordAnswer,
  settleCard,
  setRoundFlag,
  type Progress,
  type WordWithFlag,
} from '@/db/repo'
import { speakWord } from '@/lib/speech'
import { useStudyUsage } from '@/lib/use-study-usage'
import { getStudyMode } from '@/study/modes'

type StudyState = {
  words: WordWithFlag[]
  progress: Progress
  /** Session-stable per-card payloads built by the mode's prepare(). */
  payloads: Map<number, unknown>
  /** Per-card answer state; a card absent from the map is unanswered. */
  answers: Record<number, AnswerState>
  /** Per-card draft text (typing input), surviving card recycling. */
  drafts: Record<number, string>
}

/**
 * The generalized study screen: one policy (probe recording, round
 * completion, flag writes, browsing) shared by every mode, with the mode
 * contributing only its cards, payloads and copy. See src/study/types.ts.
 */
export default function StudyScreen() {
  const params = useLocalSearchParams<{ mode?: string }>()
  const mode = getStudyMode(typeof params.mode === 'string' ? params.mode : '')
  const bucketName = useAtomValue(activeBucketAtom)
  const showPage = useAtomValue(hudPageAtom)
  const showRound = useAtomValue(hudRoundAtom)
  const [loaded, setLoaded] = useState<StudyState | null>(null)
  const [browsing, setBrowsing] = useState(false)
  const deckRef = useRef<WordDeckHandle>(null)
  // The deck's current card index, mirrored for the answer gate: quiz and
  // typing lock scrolling while the card on screen is unanswered.
  const [deckIndex, setDeckIndex] = useState(0)

  // Reloads on every focus: a review pushed on top may have re-flagged words.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      void (async () => {
        const progress = await getProgress(bucketName)
        const words = await getWordsWithRoundFlag(bucketName, progress.round)
        if (!cancelled) {
          setLoaded({
            words,
            progress,
            payloads: mode.prepare?.(words) ?? new Map(),
            answers: {},
            drafts: {},
          })
        }
      })()
      return () => {
        cancelled = true
      }
    }, [bucketName, mode]),
  )

  if (!loaded) {
    return <View className="bg-white dark:bg-black flex-1" />
  }
  const { words, progress, payloads, answers, drafts } = loaded
  const frontier = Math.min(progress.pointer, words.length)

  const patch = (changes: Partial<StudyState>) =>
    setLoaded({ words, progress, payloads, answers, drafts, ...changes })

  const resumeStudying = () => {
    setBrowsing(false)
    deckRef.current?.scrollTo(frontier)
  }

  const answerList = Object.values(answers)
  const answeredCount = answerList.filter((a) => a && !('skipped' in a)).length
  const correctCount = answerList.filter((a) => a && !('skipped' in a) && a.correct).length

  const hudTextClass = 'text-[13px] text-gray-400 dark:text-gray-500'

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      <WordDeck
        ref={deckRef}
        words={words}
        resetKey={`${bucketName}:${mode.id}`}
        initialIndex={frontier}
        autoSpeak={mode.speakOnSettle}
        onSpeak={(word) => speakWord(word.word)}
        renderCard={(word: DeckWord, helpers) =>
          mode.renderCard({
            word,
            payload: payloads.get(word.position),
            answered: answers[word.position],
            onAnswer: (correct, picked) => {
              patch({ answers: { ...answers, [word.position]: { correct, picked } } })
              void recordAnswer({
                bucketId: bucketName,
                round: progress.round,
                position: word.position,
                mode: mode.id,
                correct,
              })
            },
            onSkip: () => patch({ answers: { ...answers, [word.position]: { skipped: true } } }),
            draft: drafts[word.position] ?? '',
            onDraft: (value) => patch({ drafts: { ...drafts, [word.position]: value } }),
            onReplay: helpers.onReplay,
            onToggleFlag: () => {
              const flagged = !word.flagged
              patch({
                words: words.map((w) => (w.position === word.position ? { ...w, flagged } : w)),
              })
              void setRoundFlag(bucketName, progress.round, word.position, flagged)
            },
          })
        }
        onSettle={(_, index) => {
          if (browsing || index <= progress.pointer) return
          patch({ progress: { ...progress, pointer: index } })
          void settleCard(bucketName, index)
        }}
        onScrub={() => setBrowsing(true)}
        onClose={() => router.back()}
        onIndexChange={(index) => setDeckIndex((prev) => (prev === index ? prev : index))}
        scrubbable={mode.scrubbable && progress.pointer > 0}
        scrollEnabled={
          mode.scrollable ||
          (words[deckIndex] !== undefined && answers[words[deckIndex].position] !== undefined)
        }
        headerCenter={
          browsing ? (
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
          onReached: () => {
            // Completing a round requires having walked the whole bucket in
            // study mode; scrubbing to the end records nothing.
            if (browsing || progress.pointer < words.length - 1) return false
            const round = progress.round + 1
            patch({
              progress: { ...progress, round, pointer: 0, roundStartedAt: Date.now() },
              answers: {},
              payloads: mode.prepare?.(words) ?? new Map(),
            })
            setBrowsing(false)
            void (async () => {
              // The reload must wait for the advance transaction: it carries
              // the finished round's flags into the new one (回显).
              await completeRound(bucketName)
              const fresh = await getWordsWithRoundFlag(bucketName, round)
              setLoaded((prev) =>
                prev
                  ? {
                      ...prev,
                      words: fresh,
                      payloads: mode.prepare?.(fresh) ?? new Map(),
                      drafts: {},
                    }
                  : prev,
              )
            })()
          },
          action: 'reset',
        }}
      />
    </SafeAreaView>
  )
}

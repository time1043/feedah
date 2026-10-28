import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useAtomValue, useSetAtom } from 'jotai'
import { useMemo, useState } from 'react'
import { Pressable, Text, View, useColorScheme } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { DeckWord } from '@/types/word'

import { activeBucketAtom } from '@/atoms/study'
import { DeckReadout, WordDeck } from '@/components/word-deck'
import { findBucketByName } from '@/mock/data'
import {
  currentRound,
  nextReviewTime,
  reviewCursorOf,
  roundFlagPositions,
} from '@/study/logic'
import { studyReadoutsAtom } from '@/study/settings'
import {
  completeReviewSessionAtom,
  saveReviewCursorAtom,
  setRoundFlagAtom,
  useStudyState,
} from '@/study/store'
import type { StudyState } from '@/study/types'
import { useStudySeconds } from '@/study/usage'
import { speakWord } from '@/lib/speech'

/**
 * Review is derived from one round: it walks that round's flag list. The
 * queue is snapshotted when the session mounts — unflagging updates the
 * bookmark but the word stays until the next pass, and flags added from the
 * search/browse round-trip join the list the same way. Finishing the queue
 * archives the session; whether it counts toward "time N" is decided by the
 * round's feed state (see logic.completeReviewSession).
 */
export default function ReviewScreen() {
  const { bucket: bucketParam, round: roundParam } = useLocalSearchParams<{
    bucket?: string
    round?: string
  }>()
  const activeName = useAtomValue(activeBucketAtom)
  const bucketName = bucketParam ?? activeName
  const state = useStudyState()

  if (!state) {
    // One hydration frame; the session mounts once the state is readable.
    return (
      <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']} />
    )
  }

  const round = roundParam ? Number(roundParam) : currentRound(state, bucketName)

  return (
    <ReviewSession
      key={`${bucketName}:${round}`}
      state={state}
      bucketName={bucketName}
      round={round}
    />
  )
}

function ReviewSession({
  state,
  bucketName,
  round,
}: {
  state: StudyState
  bucketName: string
  round: number
}) {
  const scheme = useColorScheme() ?? 'light'
  const bucket = findBucketByName(bucketName)
  const wordCount = bucket.words.length

  const setFlag = useSetAtom(setRoundFlagAtom)
  const saveCursor = useSetAtom(saveReviewCursorAtom)
  const completeSession = useSetAtom(completeReviewSessionAtom)
  const readouts = useAtomValue(studyReadoutsAtom)
  useStudySeconds(true)

  // Snapshotted on mount: the session's list and its "time N" label.
  const [queue] = useState(() => roundFlagPositions(state, bucketName, round))
  const [time] = useState(() => nextReviewTime(state, bucketName, round))
  const [startedAt] = useState(() => Date.now())
  const [viewIndex, setViewIndex] = useState(() => {
    const cursor = reviewCursorOf(state, bucketName, round)
    return cursor > 0 && cursor < queue.length ? cursor : 0
  })

  // Bookmark freshness comes from the live state, the queue shape does not.
  const flagSet = useMemo(
    () => new Set(roundFlagPositions(state, bucketName, round)),
    [state, bucketName, round],
  )
  const words: DeckWord[] = useMemo(
    () =>
      queue.map((position) => ({
        ...bucket.words[position - 1],
        flagged: flagSet.has(position),
      })),
    [queue, bucket, flagSet],
  )

  if (words.length === 0) {
    return (
      <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
        <View className="min-h-11 px-4 py-2 flex-row items-center">
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close review">
            <Ionicons
              name="chevron-down"
              size={28}
              color={scheme === 'dark' ? '#7A7E86' : '#9A9EA6'}
            />
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-400 dark:text-gray-500 text-[17px]">Nothing flagged yet</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      <WordDeck
        words={words}
        resetKey={`${bucketName}:${round}`}
        initialIndex={viewIndex}
        onSpeak={(word) => speakWord(word.word)}
        onSettle={(_, index) => {
          setViewIndex(index)
          saveCursor({ bucketId: bucketName, round, index })
        }}
        onScrub={(index) => setViewIndex(index)}
        onToggleFlag={(word) =>
          setFlag({
            bucketId: bucketName,
            round,
            position: word.position,
            flagged: !word.flagged,
          })
        }
        scrubbable
        headerCenter={
          <Text className="font-semibold text-gray-500 dark:text-gray-400 text-[13px]">
            Review {bucketName} {round}
          </Text>
        }
        headerRight={
          <Pressable
            hitSlop={12}
            accessibilityLabel="Search words"
            onPress={() =>
              router.push({
                pathname: '/mode/search',
                params: { bucket: bucketName, flagRound: String(round) },
              })
            }
          >
            <Ionicons name="search" size={20} color={scheme === 'dark' ? '#7A7E86' : '#9A9EA6'} />
          </Pressable>
        }
        footerLeft={readouts ? <DeckReadout>time {time}</DeckReadout> : null}
        footerRight={
          readouts ? (
            <DeckReadout>
              {viewIndex}/{queue.length}
            </DeckReadout>
          ) : null
        }
        onClose={() => router.back()}
        end={{
          render: () => (
            <View className="gap-2 flex-1 items-center justify-center">
              <Text className="font-bold text-black dark:text-white text-[28px]">
                Review complete
              </Text>
              <Text className="text-gray-400 dark:text-gray-500 text-[17px]">Nice work</Text>
            </View>
          ),
          onReached: () => {
            setViewIndex(queue.length)
            completeSession({
              bucketId: bucketName,
              round,
              wordCount,
              listSize: queue.length,
              startedAt,
            })
          },
          action: 'close',
        }}
      />
    </SafeAreaView>
  )
}

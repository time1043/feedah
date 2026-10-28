import { router } from 'expo-router'
import { useAtomValue, useSetAtom } from 'jotai'
import { useMemo, useRef, useState } from 'react'
import { Pressable, Text, View, useColorScheme } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Ionicons } from '@expo/vector-icons'
import type { DeckWord } from '@/types/word'

import { activeBucketAtom } from '@/atoms/study'
import { DeckReadout, WordDeck, type WordDeckHandle } from '@/components/word-deck'
import { findBucketByName } from '@/mock/data'
import { progressOf, roundFlagPositions } from '@/study/logic'
import { studyReadoutsAtom } from '@/study/settings'
import { settleCardAtom, setRoundFlagAtom, studyStateAtom } from '@/study/store'
import { useStudySeconds } from '@/study/usage'
import { speakWord } from '@/lib/speech'

/**
 * The study feed: swiping through the active bucket flows the round's probe
 * forward. Flags land in THIS round's list — earlier rounds keep theirs.
 * The header pill appears once the user scrubs away from the frontier —
 * browsing records nothing — and returns to the first unlearned card on tap.
 * Reaching the end page completes the round and starts the next one.
 */
export default function FeedScreen() {
  const scheme = useColorScheme() ?? 'light'
  const bucketName = useAtomValue(activeBucketAtom)
  const state = useAtomValue(studyStateAtom)
  const settle = useSetAtom(settleCardAtom)
  const setFlag = useSetAtom(setRoundFlagAtom)
  const readouts = useAtomValue(studyReadoutsAtom)
  useStudySeconds(true)

  const bucket = findBucketByName(bucketName)
  const wordCount = bucket.words.length
  const progress = progressOf(state, bucketName)
  const round = progress.round
  // This round's flag list; card bookmarks re-render when it flips.
  const flagSet = useMemo(
    () => new Set(roundFlagPositions(state, bucketName, round)),
    [state, bucketName, round],
  )

  const words: DeckWord[] = useMemo(
    () => bucket.words.map((word) => ({ ...word, flagged: flagSet.has(word.position) })),
    [bucket, flagSet],
  )

  const [browsing, setBrowsing] = useState(false)
  const deckRef = useRef<WordDeckHandle>(null)

  const frontier = Math.min(progress.pointer, wordCount)

  const resumeStudying = () => {
    setBrowsing(false)
    deckRef.current?.scrollTo(frontier)
  }

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      <WordDeck
        ref={deckRef}
        words={words}
        resetKey={bucketName}
        initialIndex={frontier}
        onSpeak={(word) => speakWord(word.word)}
        onSettle={(_, index) => {
          // The settled card is the one just left behind (its index value is
          // its 1-based position); the watermark only takes forward moves.
          if (!browsing && index > progress.pointer) {
            settle({ bucketId: bucketName, wordCount, position: index })
          }
        }}
        onScrub={() => setBrowsing(true)}
        onToggleFlag={(word) =>
          setFlag({
            bucketId: bucketName,
            round,
            position: word.position,
            flagged: !word.flagged,
          })
        }
        onClose={() => router.back()}
        scrubbable={progress.pointer > 0}
        headerCenter={
          browsing ? (
            <Pressable className="bg-blue-500 px-4 py-1.5 rounded-full" onPress={resumeStudying}>
              <Text className="font-semibold text-white text-[13px]">Resume studying</Text>
            </Pressable>
          ) : (
            <Text className="font-semibold text-gray-500 dark:text-gray-400 text-[13px]">
              Feed · {bucketName}
            </Text>
          )
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
        footerLeft={readouts ? <DeckReadout>round {round}</DeckReadout> : null}
        footerRight={
          readouts ? (
            <DeckReadout>
              {progress.pointer}/{wordCount}
            </DeckReadout>
          ) : null
        }
        end={{
          render: () => (
            <View className="gap-2 flex-1 items-center justify-center">
              <Text className="font-bold text-black dark:text-white text-[28px]">
                Round complete
              </Text>
              <Text className="text-gray-400 dark:text-gray-500 text-[17px]">
                Round {progress.round} starts in a moment
              </Text>
            </View>
          ),
          onReached: () => {
            // Completing a round requires having walked the whole bucket in
            // study mode; scrubbing to the end records nothing.
            if (browsing || progress.pointer < wordCount - 1) return false
            settle({ bucketId: bucketName, wordCount, position: wordCount })
            setBrowsing(false)
          },
          action: 'reset',
        }}
      />
    </SafeAreaView>
  )
}

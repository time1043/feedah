import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useAtomValue, useSetAtom } from 'jotai'
import { useMemo, useState } from 'react'
import { Pressable, Text, useColorScheme } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { StudyState } from '@/study/types'
import type { DeckWord } from '@/types/word'

import { DeckReadout, WordDeck } from '@/components/word-deck'
import { requestSearchReset } from '@/lib/search-reset'
import { speakWord } from '@/lib/speech'
import { findBucketByName } from '@/mock/data'
import { currentRound, roundFlagPositions } from '@/study/logic'
import { activeBucketAtom, studyReadoutsAtom } from '@/study/settings'
import { setRoundFlagAtom, useStudyState } from '@/study/store'

/**
 * Word browser: swipe up/down through the whole bucket, scrub with the
 * progress bar, flag words. Purely a lookup — none of it counts as studying,
 * moves the pointer, or records anything.
 *
 * Flags land in the round the opener pinned (a review session looking to add
 * words to its list, or a search opened from one); without an explicit round
 * they go to the bucket's current one. Opened from a search result, the
 * header search icon hands control back to the search instead.
 */
export default function BrowseScreen() {
  const {
    position,
    bucket: bucketParam,
    flagRound: flagRoundParam,
    from,
  } = useLocalSearchParams<{
    position: string
    bucket?: string
    flagRound?: string
    from?: string
  }>()
  // The opener can pin a bucket (the word list); otherwise the active one.
  const activeName = useAtomValue(activeBucketAtom)
  const bucketName = bucketParam ?? activeName
  const state = useStudyState()

  if (!state) {
    // One hydration frame; the browser mounts once the state is readable.
    return <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']} />
  }

  const flagRound = flagRoundParam ? Number(flagRoundParam) : currentRound(state, bucketName)

  return (
    <WordBrowser
      key={`${bucketName}:${flagRound}`}
      state={state}
      bucketName={bucketName}
      flagRound={flagRound}
      position={position}
      from={from}
    />
  )
}

function WordBrowser({
  state,
  bucketName,
  flagRound,
  position,
  from,
}: {
  state: StudyState
  bucketName: string
  flagRound: number
  position?: string
  from?: string
}) {
  const scheme = useColorScheme() ?? 'light'
  const setFlag = useSetAtom(setRoundFlagAtom)
  const readouts = useAtomValue(studyReadoutsAtom)
  const bucket = findBucketByName(bucketName)
  const wordCount = bucket.words.length

  // Bookmark freshness comes from the live state of the flag context round.
  const flagSet = useMemo(
    () => new Set(roundFlagPositions(state, bucketName, flagRound)),
    [state, bucketName, flagRound],
  )
  const words: DeckWord[] = useMemo(
    () => bucket.words.map((word) => ({ ...word, flagged: flagSet.has(word.position) })),
    [bucket, flagSet],
  )

  // Route param is a 1-based word position.
  const requested = Number(position)
  const initial =
    Number.isInteger(requested) && requested > 0 ? Math.min(requested, wordCount) - 1 : 0
  const [viewIndex, setViewIndex] = useState(initial)

  const openSearch = () => {
    if (from === 'search') {
      requestSearchReset()
      router.back()
      return
    }
    router.push({
      pathname: '/mode/search',
      params: { bucket: bucketName, flagRound: String(flagRound) },
    })
  }

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      <WordDeck
        words={words}
        resetKey={`${bucketName}:${initial}`}
        initialIndex={initial}
        onSpeak={(word) => speakWord(word.word)}
        onSettle={(_, index) => setViewIndex(index)}
        onScrub={(index) => setViewIndex(index)}
        onToggleFlag={(word) =>
          setFlag({
            bucketId: bucketName,
            round: flagRound,
            position: word.position,
            flagged: !word.flagged,
          })
        }
        scrubbable
        headerCenter={
          <Text className="font-semibold text-gray-500 dark:text-gray-400 text-[13px]">
            Browse · {bucketName}
          </Text>
        }
        headerRight={
          <Pressable hitSlop={12} accessibilityLabel="Search words" onPress={openSearch}>
            <Ionicons name="search" size={20} color={scheme === 'dark' ? '#7A7E86' : '#9A9EA6'} />
          </Pressable>
        }
        footerLeft={readouts ? <DeckReadout>round {flagRound}</DeckReadout> : null}
        footerRight={
          readouts ? (
            <DeckReadout>
              {viewIndex + 1}/{wordCount}
            </DeckReadout>
          ) : null
        }
        onClose={() => router.back()}
      />
    </SafeAreaView>
  )
}

import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useAtomValue } from 'jotai'
import { useCallback, useState } from 'react'
import { Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { DeckWord } from '@/types/bucket'

import { activeBucketAtom } from '@/atoms/bucket'
import { deckHeaderAtom, deckProgressBarAtom, deckTitleAtom, deckFooterAtom } from '@/atoms/deck'
import {
  autoSpeakAtom,
  speechRateAtom,
  speechRateReadyAtom,
  tapToRevealAtom,
} from '@/atoms/settings'
import { HeaderIconButton, ScreenHeader } from '@/components/header'
import { WordDeck } from '@/components/word-deck'
import { getProgress, getWordsWithRoundFlag, setRoundFlag } from '@/db/repo/study-round'
import { goBack } from '@/lib/back'
import { speakWord } from '@/lib/speech'

export default function BrowseScreen() {
  const { position, bucket: bucketParam } = useLocalSearchParams<{
    position: string
    bucket?: string
  }>()
  // The bucket the opener came from (the word list passes it); no param
  // means the home screen's default bucket.
  const bucketParamName = Array.isArray(bucketParam) ? bucketParam[0] : bucketParam
  const activeName = useAtomValue(activeBucketAtom)
  const bucketName = bucketParamName && bucketParamName.length > 0 ? bucketParamName : activeName
  // null = the database has not answered yet: the not-found pages must not
  // flash before it does.
  const [words, setWords] = useState<DeckWord[] | null>(null)
  const [bucketExists, setBucketExists] = useState(true)
  // The probe's round — the flags browse shows and writes are keyed by it, so
  // this screen marks the same cards study does, in the same round.
  const [round, setRound] = useState(1)

  // Reloads on every focus: the words and their flags follow the database, so
  // a mark made in the study deck is here when browse opens.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      void (async () => {
        try {
          const progress = await getProgress(bucketName)
          const [exists, rows] = await getWordsWithRoundFlag(bucketName, progress.round)
          if (!cancelled) {
            setBucketExists(exists)
            setRound(progress.round)
            setWords(rows)
          }
        } catch (error) {
          console.error('[browse] load failed', error)
        }
      })()
      return () => {
        cancelled = true
      }
    }, [bucketName]),
  )

  // The param is the CARD NUMBER — the data position printed on the card
  // (1701+ for the 2050 bucket), not a list index. It is the identifier
  // every surface shares: what the card shows is what opens here, and what
  // search/review will carry. The footer, by contrast, is a 1-based
  // pagination ordinal.
  const cardNumber = Number(position)
  const word = Number.isInteger(cardNumber)
    ? words?.find((candidate) => candidate.position === cardNumber)
    : undefined
  const initialIndex = word && words ? words.indexOf(word) : 0
  const speechRate = useAtomValue(speechRateAtom)
  const speechRateReady = useAtomValue(speechRateReadyAtom)
  const autoSpeak = useAtomValue(autoSpeakAtom)
  const tapToReveal = useAtomValue(tapToRevealAtom)
  const showHeader = useAtomValue(deckHeaderAtom)
  const showTitle = useAtomValue(deckTitleAtom)
  const showProgressBar = useAtomValue(deckProgressBarAtom)
  const showFooter = useAtomValue(deckFooterAtom)
  // The deck's current card, mirrored out for the footer counter. It stays
  // null until the user swipes: the card the deck opens on is the one the
  // param named, which the load settles a frame later.
  const [swiped, setSwiped] = useState<number | null>(null)
  const shownIndex = swiped ?? initialIndex

  const toggleFlag = (target: DeckWord) => {
    const flagged = !target.flagged
    // Optimistic: the bookmark must flip on the tap; the row follows.
    setWords((rows) =>
      rows
        ? rows.map((row) => (row.position === target.position ? { ...row, flagged } : row))
        : rows,
    )
    void setRoundFlag(bucketName, round, target.position, flagged).catch((error) =>
      console.error('[browse] flag write failed', error),
    )
  }

  if (words === null) {
    return <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']} />
  }

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      {word ? (
        <>
          {showHeader && (
            <ScreenHeader
              title={showTitle ? `Browse ${bucketName}` : undefined}
              onBack={goBack}
              onSearch={() => router.push('/mode/search')}
            />
          )}
          <WordDeck
            words={words}
            progressBar={showProgressBar}
            initialIndex={initialIndex}
            tapToReveal={tapToReveal}
            // Same seams as study: the deck decides when to speak, the screen
            // decides how and whether.
            canSpeak={speechRateReady && autoSpeak}
            onSpeak={(spoken) => speakWord(spoken.word, speechRate)}
            onIndexChange={setSwiped}
            onToggleFlag={toggleFlag}
            hudRight={
              showFooter ? (
                <Text
                  className="text-gray-400 dark:text-gray-500 text-[13px]"
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {shownIndex + 1}/{words.length}
                </Text>
              ) : undefined
            }
          />
        </>
      ) : (
        <>
          {/* The not-found page keeps its own way back, whatever the header
              setting; the message names the entity that is actually missing. */}
          <View className="min-h-11 px-4 py-1 flex-row items-center">
            <HeaderIconButton name="chevron-back" onPress={goBack} accessibilityLabel="Back" />
            <Text className="font-semibold text-gray-500 dark:text-gray-400 flex-1 text-center text-[13px]">
              {!bucketExists ? 'Bucket not found' : 'Word not found'}
            </Text>
            <View className="h-9 w-9" />
          </View>
          <View className="flex-1" />
        </>
      )}
    </SafeAreaView>
  )
}

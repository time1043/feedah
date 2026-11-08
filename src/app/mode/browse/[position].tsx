import { router, useLocalSearchParams } from 'expo-router'
import { useAtomValue } from 'jotai'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { deckHeaderAtom, deckProgressBarAtom, deckTitleAtom, deckFooterAtom } from '@/atoms/deck'
import {
  autoSpeakAtom,
  speechRateAtom,
  speechRateReadyAtom,
  tapToRevealAtom,
} from '@/atoms/settings'
import { HeaderIconButton, ScreenHeader } from '@/components/header'
import { WordDeck } from '@/components/word-deck'
import { speakWord } from '@/lib/speech'
import { buckets } from '@/mock/bucket'

export default function BrowseScreen() {
  const { position, bucket: bucketParam } = useLocalSearchParams<{
    position: string
    bucket?: string
  }>()
  // The bucket the opener came from (the word list passes it); no param
  // means the home screen's default bucket.
  const bucketParamName = Array.isArray(bucketParam) ? bucketParam[0] : bucketParam
  const bucketName = bucketParamName && bucketParamName.length > 0 ? bucketParamName : '2050'
  const bucket = buckets.find((candidate) => candidate.name === bucketName)
  const words = bucket?.words ?? []
  // The param is the CARD NUMBER — the data position printed on the card
  // (1701+ for the mock bucket), not a list index. It is the identifier
  // every surface shares: what the card shows is what opens here, and what
  // search/review will carry. The footer, by contrast, is a 1-based
  // pagination ordinal.
  const cardNumber = Number(position)
  const word = Number.isInteger(cardNumber)
    ? words.find((w) => w.position === cardNumber)
    : undefined
  const initialIndex = word ? words.indexOf(word) : 0
  const speechRate = useAtomValue(speechRateAtom)
  const speechRateReady = useAtomValue(speechRateReadyAtom)
  const autoSpeak = useAtomValue(autoSpeakAtom)
  const tapToReveal = useAtomValue(tapToRevealAtom)
  const showHeader = useAtomValue(deckHeaderAtom)
  const showTitle = useAtomValue(deckTitleAtom)
  const showProgressBar = useAtomValue(deckProgressBarAtom)
  const showFooter = useAtomValue(deckFooterAtom)
  // The deck's current card, mirrored out for the footer counter.
  const [current, setCurrent] = useState(initialIndex)

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      {word ? (
        <>
          {showHeader && (
            <ScreenHeader
              title={showTitle && bucket ? `Browse ${bucket.name}` : undefined}
              onBack={() => router.back()}
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
            onIndexChange={setCurrent}
            hudRight={
              showFooter ? (
                <Text
                  className="text-gray-400 dark:text-gray-500 text-[13px]"
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {current + 1}/{words.length}
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
            <HeaderIconButton
              name="chevron-back"
              onPress={() => router.back()}
              accessibilityLabel="Back"
            />
            <Text className="font-semibold text-gray-500 dark:text-gray-400 flex-1 text-center text-[13px]">
              {!bucket ? 'Bucket not found' : 'Word not found'}
            </Text>
            <View className="h-9 w-9" />
          </View>
          <View className="flex-1" />
        </>
      )}
    </SafeAreaView>
  )
}

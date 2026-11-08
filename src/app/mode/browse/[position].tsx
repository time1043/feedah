import { router, useLocalSearchParams } from 'expo-router'
import { useAtomValue } from 'jotai'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { deckHeaderAtom, deckProgressBarAtom, deckTitleAtom, hudPageAtom } from '@/atoms/deck'
import {
  autoSpeakAtom,
  speechRateAtom,
  speechRateReadyAtom,
  tapToRevealAtom,
} from '@/atoms/settings'
import { ScreenHeader } from '@/components/header'
import { WordDeck } from '@/components/word-deck'
import { speakWord } from '@/lib/speech'
import { findBucketByName } from '@/mock/bucket'

export default function BrowseScreen() {
  const { position } = useLocalSearchParams<{ position: string }>()
  const words = findBucketByName('2050').words
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
  const showFooter = useAtomValue(hudPageAtom)
  // The deck's current card, mirrored out for the footer counter.
  const [current, setCurrent] = useState(initialIndex)

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      {showHeader && (
        <ScreenHeader
          title={showTitle ? 'Browse 2050' : undefined}
          onBack={() => router.back()}
          onSearch={() => router.push('/mode/search')}
        />
      )}
      {word ? (
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
      ) : (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-400 dark:text-gray-500">Word not found</Text>
        </View>
      )}
    </SafeAreaView>
  )
}

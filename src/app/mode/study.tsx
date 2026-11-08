import { router } from 'expo-router'
import { useAtomValue } from 'jotai'
import { useState } from 'react'
import { Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { activeBucketAtom } from '@/atoms/bucket'
import { deckHeaderAtom, deckProgressBarAtom, deckTitleAtom, deckFooterAtom } from '@/atoms/deck'
import {
  autoSpeakAtom,
  speechRateAtom,
  speechRateReadyAtom,
  tapToRevealAtom,
} from '@/atoms/settings'
import { ScreenHeader } from '@/components/header'
import { WordDeck } from '@/components/word-deck'
import { goBack } from '@/lib/back'
import { speakWord } from '@/lib/speech'
import { findBucketByName } from '@/mock/bucket'

/** The study screen: swipe through the mock bucket's words, one full-screen
 * card at a time. */
export default function StudyScreen() {
  const bucketName = useAtomValue(activeBucketAtom)
  const words = findBucketByName(bucketName).words
  const speechRate = useAtomValue(speechRateAtom)
  const speechRateReady = useAtomValue(speechRateReadyAtom)
  const autoSpeak = useAtomValue(autoSpeakAtom)
  const tapToReveal = useAtomValue(tapToRevealAtom)
  const showHeader = useAtomValue(deckHeaderAtom)
  const showTitle = useAtomValue(deckTitleAtom)
  const showProgressBar = useAtomValue(deckProgressBarAtom)
  const showFooter = useAtomValue(deckFooterAtom)
  // The deck's current card, mirrored out for the footer counter.
  const [index, setIndex] = useState(0)

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      {showHeader && (
        <ScreenHeader
          title={showTitle ? `Study ${bucketName}` : undefined}
          onBack={goBack}
          onSearch={() => router.push('/mode/search')}
        />
      )}
      <WordDeck
        words={words}
        progressBar={showProgressBar}
        tapToReveal={tapToReveal}
        // The deck decides when to speak (open, settle, replay taps); the
        // screen decides how and whether — the stored rate, once its
        // hydration has settled and auto-speak is on.
        canSpeak={speechRateReady && autoSpeak}
        onSpeak={(word) => speakWord(word.word, speechRate)}
        onIndexChange={setIndex}
        hudRight={
          showFooter ? (
            <Text
              className="text-gray-400 dark:text-gray-500 text-[13px]"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {index + 1}/{words.length}
            </Text>
          ) : undefined
        }
      />
    </SafeAreaView>
  )
}

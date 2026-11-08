import { router } from 'expo-router'
import { useAtomValue } from 'jotai'
import { SafeAreaView } from 'react-native-safe-area-context'

import { deckHeaderAtom, deckProgressBarAtom, deckTitleAtom } from '@/atoms/deck'
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

/** The study screen: swipe through the mock bucket's words, one full-screen
 * card at a time. */
export default function StudyScreen() {
  const words = findBucketByName('2050').words
  const speechRate = useAtomValue(speechRateAtom)
  const speechRateReady = useAtomValue(speechRateReadyAtom)
  const autoSpeak = useAtomValue(autoSpeakAtom)
  const tapToReveal = useAtomValue(tapToRevealAtom)
  const showHeader = useAtomValue(deckHeaderAtom)
  const showTitle = useAtomValue(deckTitleAtom)
  const showProgressBar = useAtomValue(deckProgressBarAtom)

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      {showHeader && (
        <ScreenHeader
          title={showTitle ? 'Study 2050' : undefined}
          onBack={() => router.back()}
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
      />
    </SafeAreaView>
  )
}

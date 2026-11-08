import { useAtomValue } from 'jotai'
import { useEffect } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  autoSpeakAtom,
  speechRateAtom,
  speechRateReadyAtom,
  tapToRevealAtom,
} from '@/atoms/settings'
import { WordCard } from '@/components/word-card'
import { speakWord } from '@/lib/speech'
import { findBucketByName } from '@/mock/bucket'

export default function StudyScreen() {
  const word = findBucketByName('2050').words[3]
  const speechRate = useAtomValue(speechRateAtom)
  const speechRateReady = useAtomValue(speechRateReadyAtom)
  const autoSpeak = useAtomValue(autoSpeakAtom)
  const tapToReveal = useAtomValue(tapToRevealAtom)

  // Opening the card speaks the word — the screen's speech policy; the card
  // stays a pure displayer. The gate matters: the atom settles on its stored
  // rate only after the storage read, which races this screen's first frame.
  // The rate and the auto-speak toggle read fresh at call time — flipping
  // either mid-card must not re-speak.
  useEffect(() => {
    if (!speechRateReady || !autoSpeak) return
    speakWord(word.word, speechRate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word.word, speechRateReady])

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      <WordCard
        word={word}
        tapToReveal={tapToReveal}
        onReplay={() => speakWord(word.word, speechRate)}
      />
    </SafeAreaView>
  )
}

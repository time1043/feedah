import { useLocalSearchParams } from 'expo-router'
import { useAtomValue } from 'jotai'
import { useEffect } from 'react'
import { Text, View } from 'react-native'
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

export default function BrowseScreen() {
  const { position } = useLocalSearchParams<{ position: string }>()
  const words = findBucketByName('2050').words
  // The opener may pass anything: guard the index, never trust the param.
  const index = Number(position) - 1
  const word =
    Number.isInteger(index) && index >= 0 && index < words.length ? words[index] : undefined
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
    if (!word || !speechRateReady || !autoSpeak) return
    speakWord(word.word, speechRate)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rate is read fresh at call time
  }, [word?.word, speechRateReady])

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      {word ? (
        <WordCard
          word={word}
          tapToReveal={tapToReveal}
          onReplay={() => speakWord(word.word, speechRate)}
        />
      ) : (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-400 dark:text-gray-500">Word not found</Text>
        </View>
      )}
    </SafeAreaView>
  )
}

import { useLocalSearchParams } from 'expo-router'
import { useAtomValue } from 'jotai'
import { useEffect } from 'react'
import { Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { speechRateAtom } from '@/atoms/settings'
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

  // Opening the card speaks the word — the screen's speech policy; the card
  // stays a pure displayer. The deck takes this over when it lands. The rate
  // is read at speak time: changing the setting must not re-speak this card.
  useEffect(() => {
    if (!word) return
    speakWord(word.word, speechRate)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rate is read fresh at call time
  }, [word?.word])

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      {word ? (
        <WordCard word={word} onReplay={() => speakWord(word.word, speechRate)} />
      ) : (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-400 dark:text-gray-500">Word not found</Text>
        </View>
      )}
    </SafeAreaView>
  )
}

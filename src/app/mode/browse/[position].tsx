import { useLocalSearchParams } from 'expo-router'
import { useEffect } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'

import { WordCard } from '@/components/word-card'
import { speakWord } from '@/lib/speech'
import { findBucketByName } from '@/mock/bucket'

export default function BrowseScreen() {
  const { position } = useLocalSearchParams<{ position: string }>()
  const word = findBucketByName('2050').words[Number(position) - 1]

  // Opening the card speaks the word — the screen's speech policy; the card
  // stays a pure displayer. The deck takes this over when it lands.
  useEffect(() => {
    speakWord(word.word)
  }, [word.word])

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      <WordCard word={word} onReplay={() => speakWord(word.word)} />
    </SafeAreaView>
  )
}

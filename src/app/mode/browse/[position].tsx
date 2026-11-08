import { useLocalSearchParams } from 'expo-router'
import { useAtomValue } from 'jotai'
import { useEffect } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'

import { speechRateAtom } from '@/atoms/settings'
import { WordCard } from '@/components/word-card'
import { speakWord } from '@/lib/speech'
import { findBucketByName } from '@/mock/bucket'

export default function BrowseScreen() {
  const { position } = useLocalSearchParams<{ position: string }>()
  const word = findBucketByName('2050').words[Number(position) - 1]
  const speechRate = useAtomValue(speechRateAtom)

  // Opening the card speaks the word — the screen's speech policy; the card
  // stays a pure displayer. The deck takes this over when it lands. The rate
  // is read at speak time: changing the setting must not re-speak this card.
  useEffect(() => {
    speakWord(word.word, speechRate)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rate is read fresh at call time
  }, [word.word])

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      <WordCard word={word} onReplay={() => speakWord(word.word, speechRate)} />
    </SafeAreaView>
  )
}

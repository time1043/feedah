import { SafeAreaView } from 'react-native-safe-area-context'

import { WordCard } from '@/components/word-card'
import { speakWord } from '@/lib/speech'
import { findBucketByName } from '@/mock/bucket'

export default function StudyScreen() {
  const word = findBucketByName('2050').words[3]

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      <WordCard word={word} onReplay={() => speakWord(word.word)} />
    </SafeAreaView>
  )
}

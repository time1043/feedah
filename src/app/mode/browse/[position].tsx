import { useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { WordCard } from '@/components/word-card'
import { findBucketByName } from '@/mock/bucket'

export default function BrowseScreen() {
  const { position } = useLocalSearchParams<{ position: string }>()
  const word = findBucketByName('2050').words[Number(position) - 1]

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      <WordCard word={word} />
    </SafeAreaView>
  )
}

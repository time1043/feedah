import { router, useFocusEffect } from 'expo-router'
import { useAtomValue } from 'jotai'
import { useCallback, useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import { activeBucketAtom } from '@/atoms/settings'
import { getBucketCards, type BucketCard } from '@/db/repo'

/** The bucket list: one card per bucket, tap to open its word list. */
export default function BucketScreen() {
  const activeName = useAtomValue(activeBucketAtom)
  const [cards, setCards] = useState<BucketCard[]>([])

  useFocusEffect(
    useCallback(() => {
      void getBucketCards().then(setCards)
    }, []),
  )

  return (
    <View className="gap-3 bg-white p-4 dark:bg-black flex-1">
      <Text className="mb-1 font-bold text-black dark:text-white text-[22px]">Bucket</Text>
      {cards.map((card) => (
        <Pressable
          key={card.id}
          className={`rounded-2xl p-4 border ${
            card.id === activeName
              ? 'border-blue-400 dark:border-blue-600'
              : 'border-gray-300 dark:border-gray-700'
          }`}
          onPress={() => router.push({ pathname: '/words/[name]', params: { name: card.id } })}
        >
          <Text className="font-semibold text-black dark:text-white text-[17px]">{card.id}</Text>
          <Text
            className="mt-1 text-gray-500 dark:text-gray-400 text-[13px]"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            round {card.round} - {card.pointer}/{card.wordCount}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}

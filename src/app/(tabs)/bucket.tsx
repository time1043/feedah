import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import { useAtomValue } from 'jotai'
import { useCallback, useState } from 'react'
import { Pressable, Text, View, useColorScheme } from 'react-native'

import { activeBucketAtom } from '@/atoms/settings'
import { getBucketCards, type BucketCard } from '@/db/repo'

/**
 * The bucket list: one card per bucket. The card opens the word list; the
 * side button opens the bucket's round list.
 */
export default function BucketScreen() {
  const scheme = useColorScheme() ?? 'light'
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
        <View
          key={card.id}
          className={`rounded-2xl flex-row items-stretch border ${
            card.id === activeName
              ? 'border-blue-400 dark:border-blue-600'
              : 'border-gray-300 dark:border-gray-700'
          }`}
        >
          <Pressable
            className="p-4 flex-1"
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
          <Pressable
            className="w-12 items-center justify-center"
            hitSlop={8}
            accessibilityLabel={`Rounds of ${card.id}`}
            onPress={() => router.push({ pathname: '/rounds/[name]', params: { name: card.id } })}
          >
            <Ionicons name="repeat" size={20} color={scheme === 'dark' ? '#7A7E86' : '#9A9EA6'} />
          </Pressable>
        </View>
      ))}
    </View>
  )
}

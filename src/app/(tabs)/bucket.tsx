import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useState } from 'react'
import { Pressable, Text, View, useColorScheme } from 'react-native'

import { activeBucketAtom } from '@/atoms/settings'
import { getBucketCards, type BucketCard } from '@/db/repo'

/**
 * The bucket list: one clean card per bucket — progress readout plus three
 * entries (word list, round list, bucket settings).
 */
export default function BucketScreen() {
  const scheme = useColorScheme() ?? 'light'
  const muted = scheme === 'dark' ? '#7A7E86' : '#9A9EA6'
  const activeName = useAtomValue(activeBucketAtom)
  const setActiveName = useSetAtom(activeBucketAtom)
  const [cards, setCards] = useState<BucketCard[]>([])

  useFocusEffect(
    useCallback(() => {
      void getBucketCards().then(setCards)
    }, []),
  )

  const entries = (card: BucketCard) => [
    {
      icon: 'list' as const,
      label: 'Words',
      onPress: () => router.push({ pathname: '/words/[name]', params: { name: card.id } }),
    },
    {
      icon: 'repeat' as const,
      label: 'Rounds',
      onPress: () => router.push({ pathname: '/rounds/[name]', params: { name: card.id } }),
    },
    {
      icon: 'settings-outline' as const,
      label: 'Settings',
      onPress: () =>
        router.push({ pathname: '/bucket/[name]/settings', params: { name: card.id } }),
    },
  ]

  return (
    <View className="bg-white dark:bg-black flex-1">
      <Text className="p-4 pb-2 font-bold text-black dark:text-white text-[22px]">Bucket</Text>
      {cards.map((card) => (
        <View
          key={card.id}
          className={`mx-4 mb-3 rounded-2xl border ${
            card.id === activeName
              ? 'border-blue-400 dark:border-blue-600'
              : 'border-gray-300 dark:border-gray-700'
          }`}
        >
          <View className="flex-row items-stretch">
            <Pressable
              className="p-4 flex-1"
              onPress={() => router.push({ pathname: '/words/[name]', params: { name: card.id } })}
            >
              <Text className="font-semibold text-black dark:text-white text-[17px]">
                {card.id}
              </Text>
              <Text
                className="mt-1 text-gray-500 dark:text-gray-400 text-[13px]"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                round {card.round} - {card.pointer}/{card.wordCount}
              </Text>
            </Pressable>
            {entries(card).map((entry) => (
              <Pressable
                key={entry.label}
                className="w-14 items-center justify-center"
                hitSlop={4}
                accessibilityLabel={`${entry.label} of ${card.id}`}
                onPress={entry.onPress}
              >
                <Ionicons name={entry.icon} size={20} color={muted} />
                <Text className="mt-1 text-gray-500 dark:text-gray-400 text-[11px]">
                  {entry.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
      {cards.length === 0 && (
        <Text className="p-4 text-gray-400 dark:text-gray-500 text-[15px]">No buckets yet.</Text>
      )}
    </View>
  )
}

import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useState } from 'react'
import { Pressable, Text, View, useColorScheme } from 'react-native'

import { activeBucketAtom } from '@/atoms/settings'
import { getBucketCards, type BucketCard } from '@/db/repo'

/**
 * The bucket list: one clean card per bucket — progress readout plus two
 * entries (word list, round list). The page-level gear opens the list's
 * settings (default study mode, global search scope).
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

  return (
    <View className="bg-white dark:bg-black flex-1">
      <View className="p-4 pb-2 flex-row items-center justify-between">
        <Text className="font-bold text-black dark:text-white text-[22px]">Bucket</Text>
        <Pressable
          onPress={() => router.push('/bucket/settings')}
          hitSlop={8}
          accessibilityLabel="Bucket list settings"
        >
          <Ionicons name="settings-outline" size={22} color={muted} />
        </Pressable>
      </View>
      {cards.map((card) => (
        <View
          key={card.id}
          className={`mx-4 mb-3 rounded-2xl flex-row items-stretch border ${
            card.id === activeName
              ? 'border-blue-400 dark:border-blue-600'
              : 'border-gray-300 dark:border-gray-700'
          }`}
        >
          {/* Body: the bucket's word list. */}
          <Pressable
            className="p-4 flex-1"
            onPress={() => router.push({ pathname: '/words/[name]', params: { name: card.id } })}
          >
            <View className="flex-row items-center justify-between">
              <Text className="font-semibold text-black dark:text-white text-[17px]">
                {card.id}
              </Text>
            </View>
            <Text
              className="mt-1 text-gray-500 dark:text-gray-400 text-[13px]"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              round {card.round} - {card.pointer}/{card.wordCount}
            </Text>
          </Pressable>
          {/* Side: the round list with its red/green timelines. */}
          <Pressable
            className="w-14 items-center justify-center"
            hitSlop={4}
            accessibilityLabel={`Rounds of ${card.id}`}
            onPress={() => router.push({ pathname: '/rounds/[name]', params: { name: card.id } })}
          >
            <Ionicons name="repeat" size={20} color={muted} />
          </Pressable>
        </View>
      ))}
      {cards.length === 0 && (
        <Text className="p-4 text-gray-400 dark:text-gray-500 text-[15px]">No buckets yet.</Text>
      )}
    </View>
  )
}

import { router, useFocusEffect } from 'expo-router'
import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import { activeBucketAtom } from '@/atoms/settings'
import ThemeToggle from '@/components/theme-toggle'
import { getBucketCards, type BucketCard } from '@/db/repo'

export default function Index() {
  const activeName = useAtomValue(activeBucketAtom)
  const setActiveName = useSetAtom(activeBucketAtom)
  const [cards, setCards] = useState<BucketCard[]>([])

  useFocusEffect(
    useCallback(() => {
      void getBucketCards().then(setCards)
    }, []),
  )

  // The active card drives the readout; it may not be loaded yet on first frame.
  const active = cards.find((card) => card.id === activeName)
  const started = active ? active.pointer > 0 || active.round > 1 : false

  return (
    <View className="gap-6 bg-white p-6 dark:bg-black flex-1 items-center justify-center">
      <ThemeToggle />

      <View className="max-w-sm gap-3 w-full">
        <View className="gap-2 flex-row">
          {cards.map((card) => (
            <Pressable
              key={card.id}
              onPress={() => setActiveName(card.id)}
              className={`rounded-lg p-3 flex-1 items-center border ${
                card.id === activeName
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                  : 'border-gray-300 dark:border-gray-700'
              }`}
            >
              <Text className="text-black dark:text-white">{card.id}</Text>
            </Pressable>
          ))}
        </View>

        <Text className="text-gray-500 dark:text-gray-400 text-center text-[17px]">
          Round {active?.round ?? 1}
        </Text>
        <Text
          className="font-extrabold text-black dark:text-white text-center text-[40px]"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {active ? `${active.pointer} / ${active.wordCount}` : '0 / 0'}
        </Text>

        <Pressable
          className="rounded-lg bg-blue-500 p-4 items-center"
          onPress={() => router.push('/mode/feed')}
        >
          <Text className="font-bold text-white">{started ? 'Continue' : 'Start'}</Text>
        </Pressable>

        <Pressable
          disabled={!active || active.flagCount === 0}
          className="rounded-lg border-blue-500 p-3 items-center border-2 disabled:opacity-40"
          onPress={() => router.push('/mode/review')}
        >
          <Text className="font-semibold text-blue-500">Review · {active?.flagCount ?? 0}</Text>
        </Pressable>

        <Pressable
          className="rounded-lg border-gray-300 p-3 dark:border-gray-700 items-center border"
          onPress={() => router.push('/mode/search')}
        >
          <Text className="text-black dark:text-white">Search words</Text>
        </Pressable>

        <Pressable
          className="rounded-lg border-gray-300 p-3 dark:border-gray-700 items-center border"
          onPress={() =>
            router.push({ pathname: '/mode/browse/[position]', params: { position: '1' } })
          }
        >
          <Text className="text-black dark:text-white">Browse from word 1</Text>
        </Pressable>
      </View>
    </View>
  )
}

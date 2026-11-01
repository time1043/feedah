import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import { useAtom, useAtomValue } from 'jotai'
import { useCallback, useState } from 'react'
import { Pressable, Text, View, useColorScheme } from 'react-native'

import { activeBucketAtom, studyModeAtom } from '@/atoms/settings'
import { getBucketCards, type BucketCard } from '@/db/repo'
import { STUDY_MODES } from '@/study/modes'

/** The quick-resume dashboard for the active bucket: readout + launch. */
export default function Index() {
  const scheme = useColorScheme() ?? 'light'
  const activeName = useAtomValue(activeBucketAtom)
  const [studyMode] = useAtom(studyModeAtom)
  const [cards, setCards] = useState<BucketCard[]>([])

  useFocusEffect(
    useCallback(() => {
      void getBucketCards().then(setCards)
    }, []),
  )

  // The active card drives the readout; it may not be loaded yet on first frame.
  const active = cards.find((card) => card.id === activeName)
  const started = active ? active.pointer > 0 || active.round > 1 : false
  const modeLabel = STUDY_MODES.find((mode) => mode.id === studyMode)?.label ?? 'Feed'

  return (
    <View className="bg-white dark:bg-black flex-1">
      <View className="px-5 pt-2 flex-row justify-end">
        <Pressable
          onPress={() => router.push('/mode/search')}
          hitSlop={8}
          accessibilityLabel="Search words"
        >
          <Ionicons name="search" size={22} color={scheme === 'dark' ? '#7A7E86' : '#9A9EA6'} />
        </Pressable>
      </View>

      <View className="gap-6 p-6 flex-1 items-center justify-center">
        <View className="max-w-sm gap-3 w-full">
          <Text className="text-gray-500 dark:text-gray-400 text-center text-[17px]">
            {activeName} · round {active?.round ?? 1} · {modeLabel}
          </Text>
          <Text
            className="font-extrabold text-black dark:text-white text-center text-[40px]"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {active ? `${active.pointer} / ${active.wordCount}` : '0 / 0'}
          </Text>

          <Pressable
            className="rounded-lg bg-blue-500 p-4 items-center"
            onPress={() =>
              router.push({ pathname: '/mode/study/[mode]', params: { mode: studyMode } })
            }
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
        </View>
      </View>
    </View>
  )
}

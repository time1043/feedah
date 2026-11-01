import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useState } from 'react'
import { Pressable, ScrollView, Text, View, useColorScheme } from 'react-native'

import { activeBucketAtom, studyModeAtom } from '@/atoms/settings'
import { getBucketCards, type BucketCard } from '@/db/repo'
import { STUDY_MODES } from '@/study/modes'

/**
 * The per-bucket workspace: one card per bucket. The active bucket's card is
 * expanded into the full study launcher (mode chips, Continue, Review and
 * the word-list / round-list entries); the others stay folded. Tapping a
 * folded card's header makes it the active bucket.
 */
export default function BucketScreen() {
  const scheme = useColorScheme() ?? 'light'
  const activeName = useAtomValue(activeBucketAtom)
  const setActiveName = useSetAtom(activeBucketAtom)
  const [studyMode, setStudyMode] = useAtom(studyModeAtom)
  const [cards, setCards] = useState<BucketCard[]>([])

  useFocusEffect(
    useCallback(() => {
      void getBucketCards().then(setCards)
    }, []),
  )

  const openStudy = (card: BucketCard) => {
    setActiveName(card.id)
    router.push({ pathname: '/mode/study/[mode]', params: { mode: studyMode, bucket: card.id } })
  }

  return (
    <View className="bg-white dark:bg-black flex-1">
      <Text className="p-4 pb-2 font-bold text-black dark:text-white text-[22px]">Bucket</Text>
      <ScrollView contentContainerStyle={{ gap: 12, padding: 16, paddingBottom: 24 }}>
        {cards.map((card) => {
          const isActive = card.id === activeName
          return (
            <View
              key={card.id}
              className={`rounded-2xl border ${
                isActive
                  ? 'border-blue-500 dark:border-blue-600'
                  : 'border-gray-300 dark:border-gray-700'
              }`}
            >
              {/* Header: tapping a folded bucket makes it the active one. */}
              <Pressable
                className="p-4 flex-row items-center justify-between"
                onPress={() => setActiveName(card.id)}
              >
                <View>
                  <Text className="font-semibold text-black dark:text-white text-[17px]">
                    {card.id}
                  </Text>
                  <Text
                    className="mt-1 text-gray-500 dark:text-gray-400 text-[13px]"
                    style={{ fontVariant: ['tabular-nums'] }}
                  >
                    round {card.round} - {card.pointer}/{card.wordCount}
                  </Text>
                </View>
                {isActive ? (
                  <Text className="font-semibold text-blue-500 text-[13px]">studying</Text>
                ) : (
                  <Ionicons
                    name="chevron-down"
                    size={20}
                    color={scheme === 'dark' ? '#7A7E86' : '#9A9EA6'}
                  />
                )}
              </Pressable>

              {isActive && (
                <View className="gap-3 border-gray-200 p-4 dark:border-gray-800 border-t">
                  <View className="gap-2 flex-row">
                    {STUDY_MODES.map((mode) => (
                      <Pressable
                        key={mode.id}
                        onPress={() => setStudyMode(mode.id)}
                        className={`rounded-lg p-2.5 flex-1 items-center border ${
                          mode.id === studyMode
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                            : 'border-gray-300 dark:border-gray-700'
                        }`}
                      >
                        <Text
                          className={`font-semibold text-[13px] ${
                            mode.id === studyMode
                              ? 'text-blue-500'
                              : 'text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          {mode.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Pressable
                    className="rounded-xl bg-blue-500 p-4 items-center"
                    onPress={() => openStudy(card)}
                  >
                    <Text className="font-bold text-white">
                      {card.pointer > 0 || card.round > 1 ? 'Continue' : 'Start'}
                    </Text>
                  </Pressable>

                  <Pressable
                    disabled={card.flagCount === 0}
                    className="rounded-xl border-blue-500 p-3 items-center border-2 disabled:opacity-40"
                    onPress={() => router.push('/mode/review')}
                  >
                    <Text className="font-semibold text-blue-500">Review · {card.flagCount}</Text>
                  </Pressable>

                  <View className="pt-1 flex-row items-center justify-between">
                    <Pressable
                      className="gap-1.5 flex-row items-center"
                      onPress={() =>
                        router.push({ pathname: '/words/[name]', params: { name: card.id } })
                      }
                    >
                      <Ionicons
                        name="list"
                        size={18}
                        color={scheme === 'dark' ? '#7A7E86' : '#9A9EA6'}
                      />
                      <Text className="text-gray-500 dark:text-gray-400 text-[13px]">Words</Text>
                    </Pressable>
                    <Pressable
                      className="gap-1.5 flex-row items-center"
                      onPress={() =>
                        router.push({ pathname: '/rounds/[name]', params: { name: card.id } })
                      }
                    >
                      <Ionicons
                        name="repeat"
                        size={18}
                        color={scheme === 'dark' ? '#7A7E86' : '#9A9EA6'}
                      />
                      <Text className="text-gray-500 dark:text-gray-400 text-[13px]">Rounds</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

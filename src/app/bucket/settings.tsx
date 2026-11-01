import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View, useColorScheme } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { activeBucketAtom, searchScopeAtom, studyModeAtom } from '@/atoms/settings'
import { getBucketCards, type BucketCard } from '@/db/repo'
import { STUDY_MODES } from '@/study/modes'

/**
 * Settings for the bucket list itself: which bucket is being studied, the
 * default study mode, and which buckets take part in global search.
 */
export default function BucketSettingsScreen() {
  const scheme = useColorScheme() ?? 'light'
  const muted = scheme === 'dark' ? '#7A7E86' : '#9A9EA6'
  const activeName = useAtomValue(activeBucketAtom)
  const setActiveName = useSetAtom(activeBucketAtom)
  const [studyMode, setStudyMode] = useAtom(studyModeAtom)
  const [scope, setScope] = useAtom(searchScopeAtom)
  const [cards, setCards] = useState<BucketCard[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const active = cards.find((card) => card.id === activeName)

  useEffect(() => {
    let cancelled = false
    void getBucketCards().then((rows) => {
      if (!cancelled) setCards(rows)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // An empty scope means every bucket is included; the picker keeps it
  // explicit once the user touches it.
  const includes = (id: string) => scope.length === 0 || scope.includes(id)
  const toggleScope = (id: string) => {
    const all = cards.map((card) => card.id)
    if (includes(id)) {
      setScope((scope.length === 0 ? all : scope).filter((entry) => entry !== id))
    } else {
      setScope([...scope, id])
    }
  }

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      {/* header */}
      <View className="min-h-11 px-4 py-2 flex-row items-center">
        <Pressable
          className="w-8 items-start"
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityLabel="Back"
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={scheme === 'dark' ? '#7A7E86' : '#9A9EA6'}
          />
        </Pressable>
        <Text className="font-semibold text-black dark:text-white flex-1 text-center text-[17px]">
          Bucket settings
        </Text>
        <View className="w-8" />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-4 pt-2">
          <Text className="font-semibold text-black dark:text-white text-[15px]">
            Active bucket
          </Text>
          <Text className="mt-1 text-gray-500 dark:text-gray-400 text-[13px]">
            The bucket Home's readout and Continue study.
          </Text>
          {/* Collapsed dropdown row: tap to unfold the candidates, pick one to
            select and fold back. Scales to any number of buckets. */}
          <Pressable
            onPress={() => setPickerOpen((open) => !open)}
            className="mt-3 rounded-xl border-gray-300 p-3 dark:border-gray-700 flex-row items-center justify-between border"
            accessibilityLabel="Choose the active bucket"
          >
            <View>
              <Text className="font-semibold text-black dark:text-white text-[15px]">
                {activeName}
              </Text>
              <Text
                className="mt-0.5 text-gray-500 dark:text-gray-400 text-[13px]"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                round {active?.round ?? 1} - {active?.pointer ?? 0}/{active?.wordCount ?? 0}
              </Text>
            </View>
            <Ionicons
              name={pickerOpen ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={muted ?? '#9A9EA6'}
            />
          </Pressable>
          {pickerOpen && (
            <View className="mt-2 gap-2">
              {cards.map((card) => {
                const isStudying = card.id === activeName
                return (
                  <Pressable
                    key={card.id}
                    onPress={() => {
                      setActiveName(card.id)
                      setPickerOpen(false)
                    }}
                    className={`rounded-xl p-3 flex-row items-center justify-between border ${
                      isStudying
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                        : 'border-gray-300 dark:border-gray-700'
                    }`}
                  >
                    <View>
                      <Text
                        className={`font-semibold text-[15px] ${
                          isStudying ? 'text-blue-500' : 'text-black dark:text-white'
                        }`}
                      >
                        {card.id}
                      </Text>
                      <Text
                        className="mt-0.5 text-gray-500 dark:text-gray-400 text-[13px]"
                        style={{ fontVariant: ['tabular-nums'] }}
                      >
                        round {card.round} - {card.pointer}/{card.wordCount}
                      </Text>
                    </View>
                    {isStudying && (
                      <View className="gap-1.5 flex-row items-center">
                        <Ionicons name="checkmark-circle" size={18} color="#208AEF" />
                        <Text className="font-semibold text-blue-500 text-[13px]">studying</Text>
                      </View>
                    )}
                  </Pressable>
                )
              })}
            </View>
          )}
        </View>

        {/* Default study mode */}
        <View className="px-4 pt-8">
          <Text className="font-semibold text-black dark:text-white text-[15px]">
            Default study mode
          </Text>
          <Text className="mt-1 text-gray-500 dark:text-gray-400 text-[13px]">
            Used by Continue on the home screen.
          </Text>
          <View className="mt-3 gap-2 flex-row">
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
                    mode.id === studyMode ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {mode.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Global search scope */}
        <View className="px-4 pt-8">
          <Text className="font-semibold text-black dark:text-white text-[15px]">
            Global search scope
          </Text>
          <Text className="mt-1 text-gray-500 dark:text-gray-400 text-[13px]">
            Buckets searched when no single bucket is pinned. Current:{' '}
            {scope.length === 0 ? 'all buckets' : scope.join(', ')}
          </Text>
          <View className="mt-3 gap-2 flex-row flex-wrap">
            {cards.map((card) => (
              <Pressable
                key={card.id}
                onPress={() => toggleScope(card.id)}
                className={`px-4 py-2 rounded-full border ${
                  includes(card.id)
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                    : 'border-gray-300 dark:border-gray-700'
                }`}
              >
                <Text
                  className={`text-[13px] ${
                    includes(card.id)
                      ? 'font-semibold text-blue-500'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {card.id}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

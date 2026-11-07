import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useState } from 'react'
import { Modal, Pressable, ScrollView, Text, View, useColorScheme } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { activeBucketAtom, searchScopeAtom, studyDrillAtom } from '@/atoms/settings'
import { getBucketCards, restoreBuckets, tombstonedBuckets, type BucketCard } from '@/db/repo'
import { getDrills } from '@/drills/registry'

/**
 * Settings for the bucket list itself: which bucket is being studied, the
 * default study mode, and which buckets take part in global search.
 */
export default function BucketSettingsScreen() {
  const scheme = useColorScheme() ?? 'light'
  const muted = scheme === 'dark' ? '#7A7E86' : '#9A9EA6'
  const activeName = useAtomValue(activeBucketAtom)
  const setActiveName = useSetAtom(activeBucketAtom)
  const [studyDrill, setStudyDrill] = useAtom(studyDrillAtom)
  const [scope, setScope] = useAtom(searchScopeAtom)
  const [cards, setCards] = useState<BucketCard[]>([])
  const [tombstoned, setTombstoned] = useState<string[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const active = cards.find((card) => card.id === activeName)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [rows, deleted] = await Promise.all([getBucketCards(), tombstonedBuckets()])
      if (!cancelled) {
        setCards(rows)
        setTombstoned(deleted)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  /** Un-tombstones the deleted built-ins; their history was never gone. */
  const restoreDeleted = async () => {
    await restoreBuckets(tombstoned)
    setCards(await getBucketCards())
    setTombstoned(await tombstonedBuckets())
  }

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
        {/* Active bucket: a collapsed row opening the picker modal, so the
            sections below never get pushed around by a long list. */}
        <View className="px-4 pt-2">
          <Text className="font-semibold text-black dark:text-white text-[15px]">
            Active bucket
          </Text>
          <Text className="mt-1 text-gray-500 dark:text-gray-400 text-[13px]">
            The bucket Home's readout and Continue study.
          </Text>
          <Pressable
            onPress={() => setPickerOpen(true)}
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
            <Ionicons name="chevron-forward" size={20} color={muted} />
          </Pressable>
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
            {getDrills().map((drill) => (
              <Pressable
                key={drill.id}
                onPress={() => setStudyDrill(drill.id)}
                className={`rounded-lg p-2.5 flex-1 items-center border ${
                  drill.id === studyDrill
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                    : 'border-gray-300 dark:border-gray-700'
                }`}
              >
                <Text
                  className={`font-semibold text-[13px] ${
                    drill.id === studyDrill ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {drill.label}
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

        {/* Restore built-ins: only exists while something is deleted. The
            rows never left, so this is pure recovery — no confirmation. */}
        {tombstoned.length > 0 && (
          <View className="px-4 pt-8">
            <Text className="font-semibold text-black dark:text-white text-[15px]">
              Restore built-in buckets
            </Text>
            <Text className="mt-1 text-gray-500 dark:text-gray-400 text-[13px]">
              Bring deleted word lists back with their study history: {tombstoned.join(', ')}.
            </Text>
            <Pressable
              onPress={() => void restoreDeleted()}
              className="mt-3 rounded-xl border-gray-300 p-3 dark:border-gray-700 items-center border"
              accessibilityLabel="Restore built-in buckets"
            >
              <Text className="font-semibold text-blue-500 text-[15px]">
                Restore {tombstoned.join(', ')}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Active-bucket picker */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable
          className="bg-black/50 p-6 flex-1 items-center justify-center"
          onPress={() => setPickerOpen(false)}
        >
          {/* Blocks backdrop taps inside the card. */}
          <Pressable className="max-w-sm rounded-2xl bg-white p-4 dark:bg-gray-900 max-h-[70%] w-full">
            <Text className="font-semibold text-black dark:text-white text-[15px]">
              Active bucket
            </Text>
            <ScrollView className="mt-3" showsVerticalScrollIndicator={false}>
              {cards.map((card) => {
                const isStudying = card.id === activeName
                return (
                  <Pressable
                    key={card.id}
                    onPress={() => {
                      setActiveName(card.id)
                      setPickerOpen(false)
                    }}
                    className={`mt-2 rounded-xl p-3 flex-row items-center justify-between border ${
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
                    {isStudying && <Ionicons name="checkmark-circle" size={20} color="#208AEF" />}
                  </Pressable>
                )
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

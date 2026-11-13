import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router, useFocusEffect } from 'expo-router'
import { useAtom, useAtomValue } from 'jotai'
import { useCallback, useState } from 'react'
import { Pressable, Text, View, useColorScheme } from 'react-native'

import { activeBucketAtom } from '@/atoms/bucket'
import { studyDrillAtom } from '@/atoms/settings'
import { HeaderIconButton, TabHeader } from '@/components/header'
import { getBucketCards, type BucketCard } from '@/db/repo/bucket-word'
import { getDrills } from '@/drills/registry'
import { FLAG_RED } from '@/lib/color'

const LOGO_MARK = require('../../../assets/images/logo-mark.png')

/**
 * The quick-resume dashboard for the active bucket, the prototype's home:
 * the leaf-and-wordmark header, a chip-and-round line above a huge count
 * readout, then the mode switch and the launch buttons.
 */
export default function Index() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  const activeName = useAtomValue(activeBucketAtom)
  const [studyDrill, setStudyDrill] = useAtom(studyDrillAtom)
  const [cards, setCards] = useState<BucketCard[]>([])

  // Reloads on every focus: studying, reviewing or flagging in a deck moves
  // the numbers this dashboard reads.
  useFocusEffect(
    useCallback(() => {
      void getBucketCards()
        .then(setCards)
        .catch((error) => console.error('[home] cards failed', error))
    }, []),
  )

  // The active card drives the readout; it may not be loaded yet on first frame.
  const active = cards.find((card) => card.name === activeName)
  const started = active ? active.pointer > 0 || active.round > 1 : false
  const wordsLeft = active ? Math.max(0, active.wordCount - active.pointer) : 0
  const progress = active && active.wordCount > 0 ? (active.pointer / active.wordCount) * 100 : 0

  return (
    <View className="bg-white dark:bg-black flex-1">
      <TabHeader
        left={
          <View className="gap-2 flex-row items-center">
            <Image source={LOGO_MARK} style={{ width: 26, height: 26 }} contentFit="contain" />
            <Text className="font-extrabold text-black dark:text-white text-[20px]">feedah</Text>
          </View>
        }
        right={
          <HeaderIconButton
            name="search"
            onPress={() => router.push('/mode/search')}
            accessibilityLabel="Search words"
          />
        }
      />

      {cards.length === 0 ? (
        // Every bucket deleted (or none imported): nothing to resume.
        <View className="gap-1 px-6 flex-1 items-center justify-center">
          <Text className="font-semibold text-black dark:text-white text-[17px]">
            No buckets yet
          </Text>
          <Text className="text-gray-400 dark:text-gray-500 text-[15px]">
            Import one on the Bucket tab
          </Text>
        </View>
      ) : (
        <View className="gap-10 px-6 pb-8 flex-1 justify-center">
          {/* The readout: bucket chip, the round's count, its bar, its tail. */}
          <View className="gap-3">
            <View className="gap-3 flex-row items-center">
              <View className="bg-gray-100 px-3.5 py-1.5 dark:bg-gray-800 rounded-full">
                <Text className="font-bold text-black dark:text-white text-[15px]">
                  Bucket {activeName}
                </Text>
              </View>
              <Text className="text-gray-500 dark:text-gray-400 text-[15px]">
                Round {active?.round ?? 1}
              </Text>
            </View>

            <View className="gap-2 flex-row items-baseline">
              <Text
                className="font-extrabold text-black dark:text-white text-[64px]"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {active?.pointer ?? 0}
              </Text>
              <Text
                className="font-extrabold text-gray-400 dark:text-gray-500 text-[36px]"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                / {active?.wordCount ?? 0}
              </Text>
            </View>

            <View className="h-1.5 bg-gray-200 dark:bg-gray-800 overflow-hidden rounded-full">
              <View
                className="h-1.5 bg-accent rounded-full"
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </View>

            <Text className="text-gray-500 dark:text-gray-400 text-[15px]">
              {wordsLeft} words left in this round
            </Text>
          </View>

          {/* The launchpad: mode switch, the lime study entry, the review
              entry with its flag badge. Browsing stays behind the bucket
              list and search — the home launch keeps one job. */}
          <View className="gap-3">
            <View className="bg-gray-100 p-1 dark:bg-gray-800 flex-row rounded-full">
              {getDrills().map((drill) => {
                const selected = drill.id === studyDrill
                return (
                  <Pressable
                    key={drill.id}
                    onPress={() => setStudyDrill(drill.id)}
                    className={`py-2.5 flex-1 items-center rounded-full ${selected ? 'bg-accent' : ''}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${drill.label} mode`}
                  >
                    <Text
                      className={`font-bold text-[15px] ${
                        selected ? 'text-black' : 'text-gray-500 dark:text-gray-300'
                      }`}
                    >
                      {drill.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>

            <Pressable
              className="gap-2 rounded-2xl bg-accent py-4 flex-row items-center justify-center"
              onPress={() =>
                router.push({ pathname: '/mode/study/[drill]', params: { drill: studyDrill } })
              }
              accessibilityRole="button"
              accessibilityLabel={started ? 'Continue studying' : 'Start studying'}
            >
              <Text className="font-bold text-black text-[17px]">
                {started ? 'Continue' : 'Start'}
              </Text>
              <Ionicons name="arrow-up" size={18} color="black" />
            </Pressable>

            <Pressable
              disabled={!active || active.flagCount === 0}
              className="gap-2 rounded-2xl border-gray-300 py-3.5 dark:border-gray-700 flex-row items-center justify-center border disabled:opacity-40"
              onPress={() => router.push('/mode/review')}
              accessibilityLabel={`Review ${active?.flagCount ?? 0} flagged words`}
            >
              <Text className="font-bold text-black dark:text-white text-[17px]">Review</Text>
              <View
                className="h-7 min-w-7 px-2 items-center justify-center rounded-full"
                style={{ backgroundColor: FLAG_RED[scheme] }}
              >
                <Text className="font-bold text-white text-[13px]">{active?.flagCount ?? 0}</Text>
              </View>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  )
}

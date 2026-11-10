import { router, useFocusEffect } from 'expo-router'
import { useAtom, useAtomValue } from 'jotai'
import { useCallback, useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import { activeBucketAtom } from '@/atoms/bucket'
import { studyDrillAtom } from '@/atoms/settings'
import { HeaderIconButton, TabHeader } from '@/components/header'
import { getBucketCards, type BucketCard } from '@/db/repo/bucket-word'
import { getDrill } from '@/drills/registry'

/** The quick-resume dashboard for the active bucket: readout + launch. */
export default function Index() {
  const activeName = useAtomValue(activeBucketAtom)
  const [studyDrill] = useAtom(studyDrillAtom)
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
  const drillLabel = getDrill(studyDrill).label

  return (
    <View className="bg-white dark:bg-black flex-1">
      <TabHeader
        right={
          <HeaderIconButton
            name="search"
            onPress={() => router.push('/mode/search')}
            accessibilityLabel="Search words"
          />
        }
      />

      <View className="gap-6 p-6 flex-1 items-center justify-center">
        <View className="max-w-sm gap-3 w-full">
          {cards.length === 0 ? (
            // Every bucket deleted (or none imported): nothing to resume.
            <View className="gap-1 items-center">
              <Text className="font-semibold text-black dark:text-white text-[17px]">
                No buckets yet
              </Text>
              <Text className="text-gray-400 dark:text-gray-500 text-[15px]">
                Import one on the Bucket tab
              </Text>
            </View>
          ) : (
            <>
              <Text className="text-gray-500 dark:text-gray-400 text-center text-[17px]">
                {activeName} · round {active?.round ?? 1} · {drillLabel}
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
                  router.push({ pathname: '/mode/study/[drill]', params: { drill: studyDrill } })
                }
              >
                <Text className="font-bold text-white">{started ? 'Continue' : 'Start'}</Text>
              </Pressable>

              <Pressable
                disabled={!active || active.flagCount === 0}
                className="rounded-lg border-blue-500 p-3 items-center border-2 disabled:opacity-40"
                onPress={() => router.push('/mode/review')}
                accessibilityLabel={`Review ${active?.flagCount ?? 0} flagged words`}
              >
                <Text className="font-semibold text-blue-500">
                  Review · {active?.flagCount ?? 0}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </View>
  )
}

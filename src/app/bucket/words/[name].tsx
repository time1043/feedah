import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useAtomValue } from 'jotai'
import { useRef, useState } from 'react'
import { FlatList, Pressable, Text, View, useColorScheme } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { Word } from '@/types/bucket'

import { wordsMeaningAtom } from '@/atoms/words'
import { ListHeader, MUTED } from '@/components/header'
import { ProgressBar } from '@/components/progress-bar'
import { goBack } from '@/lib/back'
import { ACCENT } from '@/lib/color'
import { useNavGuard } from '@/lib/use-nav-guard'
import { buckets } from '@/mock/bucket'

const ROW_HEIGHT = 52

/**
 * The word list of one bucket: every word in order, the meaning column
 * behind the eye toggle, and a progress bar that mirrors the top visible
 * row and scrubs the list. The eye is per-visit — it starts from the global
 * word-meanings setting on every entry and never writes back to it. Tapping
 * a row opens the word in the browse deck, by its card number. Pure lookup
 * — nothing is recorded.
 */
export default function WordsScreen() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  const { name } = useLocalSearchParams<{ name: string }>()
  const bucketName = Array.isArray(name) ? name[0] : name
  // Honest guard: an unknown name is not found (no silent first-bucket
  // fallback).
  const bucket = buckets.find((candidate) => candidate.name === bucketName)
  const words = bucket?.words ?? []
  const meaningDefault = useAtomValue(wordsMeaningAtom)
  // The eye follows the stored setting once it has hydrated — a mount-time
  // seed would capture the factory value on a cold-start deep link — and a
  // tap overrides it for this visit only (null = no override yet). It never
  // writes back to the setting.
  const [override, setOverride] = useState<boolean | null>(null)
  const showMeaning = override ?? meaningDefault
  const guardedPush = useNavGuard()
  // The top visible row, mirrored by the progress bar.
  const [index, setIndex] = useState(0)
  const listRef = useRef<FlatList<Word> | null>(null)

  const jumpTo = (target: number) => {
    if (words.length === 0) return
    const clamped = Math.max(0, Math.min(target, words.length - 1))
    setIndex(clamped)
    listRef.current?.scrollToIndex({ index: clamped, animated: false })
  }

  const trackScroll = (offsetY: number) => {
    setIndex(Math.max(0, Math.min(words.length - 1, Math.round(offsetY / ROW_HEIGHT))))
  }

  const openWord = (word: Word) => {
    if (!bucket) return
    guardedPush(() =>
      router.push({
        pathname: '/mode/browse/[position]',
        params: { position: String(word.position), bucket: bucket.name },
      }),
    )
  }

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      <ListHeader
        title={bucket?.name}
        onBack={goBack}
        right={
          <Pressable
            className="h-9 w-9 items-center justify-center"
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={showMeaning ? 'Hide meanings' : 'Show meanings'}
            onPress={() => setOverride(!showMeaning)}
          >
            <Ionicons
              name={showMeaning ? 'eye' : 'eye-off'}
              size={22}
              color={showMeaning ? ACCENT : MUTED[scheme]}
            />
          </Pressable>
        }
      />

      {!bucket ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-400 dark:text-gray-500">Bucket not found</Text>
        </View>
      ) : (
        <>
          <View className="px-4">
            {words.length > 0 && (
              <ProgressBar
                value={index}
                max={Math.max(words.length, 1)}
                scrubbable
                onScrub={jumpTo}
              />
            )}
          </View>
          <FlatList
            ref={listRef}
            data={words}
            keyExtractor={(word) => String(word.position)}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.word}, ${item.meaning}`}
                onPress={() => openWord(item)}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <Row word={item} showMeaning={showMeaning} />
              </Pressable>
            )}
            getItemLayout={(_, i) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * i, index: i })}
            initialNumToRender={20}
            windowSize={7}
            showsVerticalScrollIndicator={false}
            onMomentumScrollEnd={(event) => trackScroll(event.nativeEvent.contentOffset.y)}
            onScrollEndDrag={(event) => trackScroll(event.nativeEvent.contentOffset.y)}
          />
        </>
      )}
    </SafeAreaView>
  )
}

function Row({ word, showMeaning }: { word: Word; showMeaning: boolean }) {
  return (
    <View
      className="border-gray-200 px-4 dark:border-gray-800 flex-row items-center border-b"
      style={{ height: ROW_HEIGHT }}
    >
      <Text
        className="w-12 text-gray-400 dark:text-gray-500 text-[13px]"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {word.position}
      </Text>
      <Text
        numberOfLines={1}
        className={`mr-2 font-semibold text-black dark:text-white text-[15px] ${
          showMeaning ? 'flex-1' : 'flex-[2.1]'
        }`}
      >
        {word.word}
      </Text>
      {showMeaning && (
        <Text numberOfLines={1} className="text-gray-500 dark:text-gray-400 flex-1 text-[15px]">
          {word.meaning}
        </Text>
      )}
    </View>
  )
}

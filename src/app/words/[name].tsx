import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useAtom, useAtomValue } from 'jotai'
import { useRef, useState } from 'react'
import { FlatList, Pressable, Text, View, useColorScheme } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { Word } from '@/types/word'

import { flagsAtom, flagKey, wordsMeaningAtom } from '@/atoms/study'
import { ProgressBar } from '@/components/progress-bar'
import { findBucketByName } from '@/mock/data'

const ROW_HEIGHT = 52

/**
 * The word list of one bucket: every word in order, flagged words marked
 * with a red dot, the meaning column behind the eye toggle. Scrub the
 * progress bar or scroll freely; tapping a row opens the word in the browse
 * deck. Pure lookup — nothing here is recorded.
 */
export default function WordsScreen() {
  const scheme = useColorScheme() ?? 'light'
  const { name } = useLocalSearchParams<{ name: string }>()
  const bucketName = Array.isArray(name) ? name[0] : name
  const bucket = findBucketByName(bucketName)
  const flags = useAtomValue(flagsAtom)
  const [showMeaning, setShowMeaning] = useAtom(wordsMeaningAtom)

  // The top visible row, mirrored by the progress bar.
  const [index, setIndex] = useState(0)
  const listRef = useRef<FlatList<Word> | null>(null)
  // Row taps can double-fire while the next screen is pushing.
  const navigating = useRef(false)

  const jumpTo = (target: number) => {
    const clamped = Math.max(0, Math.min(target, bucket.words.length - 1))
    setIndex(clamped)
    listRef.current?.scrollToIndex({ index: clamped, animated: false })
  }

  const trackScroll = (offsetY: number) => {
    setIndex(Math.max(0, Math.min(bucket.words.length - 1, Math.round(offsetY / ROW_HEIGHT))))
  }

  const openWord = (word: Word) => {
    if (navigating.current) return
    navigating.current = true
    router.push({
      pathname: '/mode/browse/[position]',
      params: { position: String(word.position), bucket: bucketName },
    })
    setTimeout(() => {
      navigating.current = false
    }, 500)
  }

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
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
          {bucketName}
        </Text>
        <Pressable
          className="w-8 items-end"
          hitSlop={12}
          accessibilityLabel="Toggle meanings"
          onPress={() => setShowMeaning(!showMeaning)}
        >
          <Ionicons
            name={showMeaning ? 'eye' : 'eye-off'}
            size={20}
            color={
              showMeaning
                ? scheme === 'dark'
                  ? '#4CA0F0'
                  : '#208AEF'
                : scheme === 'dark'
                  ? '#7A7E86'
                  : '#9A9EA6'
            }
          />
        </Pressable>
      </View>

      <View className="px-4">
        <ProgressBar value={index} max={bucket.words.length} scrubbable onScrub={jumpTo} />
      </View>

      <FlatList
        ref={listRef}
        data={bucket.words}
        keyExtractor={(word) => String(word.position)}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openWord(item)}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Row
              word={item}
              flagged={!!flags[flagKey(bucketName, item)]}
              showMeaning={showMeaning}
            />
          </Pressable>
        )}
        getItemLayout={(_, i) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * i, index: i })}
        initialNumToRender={20}
        windowSize={7}
        showsVerticalScrollIndicator={false}
        onMomentumScrollEnd={(event) => trackScroll(event.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(event) => trackScroll(event.nativeEvent.contentOffset.y)}
      />
    </SafeAreaView>
  )
}

function Row({
  word,
  flagged,
  showMeaning,
}: {
  word: Word
  flagged: boolean
  showMeaning: boolean
}) {
  return (
    <View
      className="border-gray-200 px-4 dark:border-gray-800 flex-row items-center border-b"
      style={{ height: ROW_HEIGHT }}
    >
      <Text
        className="w-10 text-gray-400 dark:text-gray-500 text-[13px]"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {word.position}
      </Text>
      {flagged && <View className="mr-1.5 h-1.5 w-1.5 rounded-sm bg-red-500" />}
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

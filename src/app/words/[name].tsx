import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useAtom } from 'jotai'
import { useCallback, useRef, useState } from 'react'
import { FlatList, Pressable, Text, View, useColorScheme } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { wordsMeaningAtom } from '@/atoms/settings'
import { ProgressBar } from '@/components/progress-bar'
import { getProgress, getWordsWithRoundFlag, type WordWithFlag } from '@/db/repo'

const ROW_HEIGHT = 52

/**
 * The word list of one bucket: every word in order, flagged words (in the
 * bucket's current round) marked with a red dot, the meaning column behind
 * the eye toggle. Scrub the progress bar or scroll freely; tapping a row
 * opens the word in the browse deck. Pure lookup — nothing is recorded.
 */
export default function WordsScreen() {
  const scheme = useColorScheme() ?? 'light'
  const { name } = useLocalSearchParams<{ name: string }>()
  const bucketName = Array.isArray(name) ? name[0] : name
  const [showMeaning, setShowMeaning] = useAtom(wordsMeaningAtom)

  // The top visible row, mirrored by the progress bar.
  const [index, setIndex] = useState(0)
  const [words, setWords] = useState<WordWithFlag[] | null>(null)
  const listRef = useRef<FlatList<WordWithFlag> | null>(null)
  // Row taps can double-fire while the next screen is pushing.
  const navigating = useRef(false)

  // Reloads on every focus: the flag dots follow the bucket's current round.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      void (async () => {
        const progress = await getProgress(bucketName)
        const loaded = await getWordsWithRoundFlag(bucketName, progress.round)
        if (!cancelled) setWords(loaded)
      })()
      return () => {
        cancelled = true
      }
    }, [bucketName]),
  )

  const jumpTo = (target: number) => {
    const clamped = Math.max(0, Math.min(target, (words?.length ?? 1) - 1))
    setIndex(clamped)
    listRef.current?.scrollToIndex({ index: clamped, animated: false })
  }

  const trackScroll = (offsetY: number) => {
    setIndex(Math.max(0, Math.min((words?.length ?? 1) - 1, Math.round(offsetY / ROW_HEIGHT))))
  }

  const openWord = (word: WordWithFlag) => {
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
        <ProgressBar
          value={index}
          max={Math.max(words?.length ?? 0, 1)}
          scrubbable
          onScrub={jumpTo}
        />
      </View>

      {words && (
        <FlatList
          ref={listRef}
          data={words}
          keyExtractor={(word) => String(word.position)}
          renderItem={({ item }) => (
            <Pressable
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
      )}
    </SafeAreaView>
  )
}

function Row({ word, showMeaning }: { word: WordWithFlag; showMeaning: boolean }) {
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
      {word.flagged && <View className="mr-1.5 h-1.5 w-1.5 rounded-sm bg-red-500" />}
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

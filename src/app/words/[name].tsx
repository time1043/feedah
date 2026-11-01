import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useAtomValue } from 'jotai'
import { useCallback, useRef, useState } from 'react'
import { FlatList, Pressable, Text, View, useColorScheme } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { wordsMeaningAtom } from '@/atoms/settings'
import { ScreenHeader } from '@/components/header'
import { ProgressBar } from '@/components/progress-bar'
import { getProgress, getWordsWithRoundFlag, type WordWithFlag } from '@/db/repo'
import { useNavGuard } from '@/lib/use-nav-guard'

const MUTED = { light: '#9A9EA6', dark: '#7A7E86' } as const

const ROW_HEIGHT = 52

/**
 * The word list of one bucket: every word in order, flagged words (in the
 * bucket's current round) marked with a red dot, the meaning column behind
 * the eye toggle. Scrub the progress bar or scroll freely; tapping a row
 * opens the word in the browse deck. Pure lookup — nothing is recorded.
 */
export default function WordsScreen() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  const { name } = useLocalSearchParams<{ name: string }>()
  const bucketName = Array.isArray(name) ? name[0] : name
  // The eye is per-visit: it starts from the global word-meanings setting on
  // every entry and never writes back to it.
  const meaningDefault = useAtomValue(wordsMeaningAtom)
  const [showMeaning, setShowMeaning] = useState(meaningDefault)

  // The top visible row, mirrored by the progress bar.
  const [index, setIndex] = useState(0)
  const [words, setWords] = useState<WordWithFlag[] | null>(null)
  const listRef = useRef<FlatList<WordWithFlag> | null>(null)
  const guardedPush = useNavGuard()

  // Reloads on every focus: the flag dots follow the bucket's current round.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      setShowMeaning(meaningDefault)
      void (async () => {
        const progress = await getProgress(bucketName)
        const loaded = await getWordsWithRoundFlag(bucketName, progress.round)
        if (!cancelled) setWords(loaded)
      })()
      return () => {
        cancelled = true
      }
    }, [bucketName, meaningDefault]),
  )

  const jumpTo = (target: number) => {
    const clamped = Math.max(0, Math.min(target, (words?.length ?? 1) - 1))
    setIndex(clamped)
    listRef.current?.scrollToIndex({ index: clamped, animated: false })
  }

  const trackScroll = (offsetY: number) => {
    setIndex(Math.max(0, Math.min((words?.length ?? 1) - 1, Math.round(offsetY / ROW_HEIGHT))))
  }

  const openWord = (word: WordWithFlag) =>
    guardedPush(() =>
      router.push({
        pathname: '/mode/browse/[position]',
        params: { position: String(word.position), bucket: bucketName },
      }),
    )

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      <ScreenHeader
        title={bucketName}
        onBack={() => router.back()}
        right={
          <Pressable
            className="h-9 w-9 items-center justify-center"
            hitSlop={4}
            accessibilityLabel="Toggle meanings"
            onPress={() => setShowMeaning(!showMeaning)}
          >
            <Ionicons
              name={showMeaning ? 'eye' : 'eye-off'}
              size={22}
              color={showMeaning ? '#208AEF' : MUTED[scheme]}
            />
          </Pressable>
        }
      />

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

import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useAtomValue } from 'jotai'
import { useState } from 'react'
import { FlatList, Pressable, Text, View, useColorScheme } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { Word } from '@/types/bucket'

import { wordsMeaningAtom } from '@/atoms/words'
import { ListHeader, MUTED } from '@/components/header'
import { useNavGuard } from '@/lib/use-nav-guard'
import { buckets } from '@/mock/bucket'

const ROW_HEIGHT = 52

/**
 * The word list of one bucket: every word in order, the meaning column
 * behind the eye toggle. The eye is per-visit — it starts from the global
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
        onBack={() => router.back()}
        right={
          <Pressable
            className="h-9 w-9 items-center justify-center"
            hitSlop={4}
            accessibilityLabel="Toggle meanings"
            onPress={() => setOverride(!showMeaning)}
          >
            <Ionicons
              name={showMeaning ? 'eye' : 'eye-off'}
              size={22}
              color={showMeaning ? '#208AEF' : MUTED[scheme]}
            />
          </Pressable>
        }
      />

      {!bucket ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-400 dark:text-gray-500">Bucket not found</Text>
        </View>
      ) : (
        <FlatList
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
        />
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

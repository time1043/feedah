import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useAtomValue } from 'jotai'
import { useEffect, useState } from 'react'
import { FlatList, Pressable, Text, TextInput, View, useColorScheme } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { searchLocalAtom, searchScopeAtom } from '@/atoms/settings'
import { MUTED } from '@/components/header'
import { getBuckets } from '@/db/repo/bucket-word'
import { searchWords, type SearchResult } from '@/db/repo/search'
import { useNavGuard } from '@/lib/use-nav-guard'

/**
 * Word lookup. Without a pinned bucket it spans the configured global scope
 * (all buckets by default); opened from a deck or a review it is pinned to
 * that bucket — unless local search is off, in which case the global scope
 * applies. Results open the browse deck pinned to their bucket, so flagging
 * lands in the right round.
 */
export default function SearchScreen() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  const params = useLocalSearchParams<{ bucket?: string }>()
  const configuredScope = useAtomValue(searchScopeAtom)
  const localSearch = useAtomValue(searchLocalAtom)

  const pinnedBucket = typeof params.bucket === 'string' && params.bucket ? params.bucket : ''

  const [scope, setScope] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const guardedPush = useNavGuard()

  useEffect(() => {
    let cancelled = false
    void (async () => {
      // The bucket list doubles as the default scope; one read either way,
      // and the pinned bucket simply narrows it.
      const all =
        configuredScope.length > 0 ? configuredScope : (await getBuckets()).map((b) => b.name)
      const names = pinnedBucket && localSearch ? [pinnedBucket] : all
      if (!cancelled) setScope(names)
    })()
    return () => {
      cancelled = true
    }
  }, [pinnedBucket, localSearch, configuredScope])

  // The search itself is debounced and derived: an empty query shows an
  // empty list without touching state, and a stale response never lands.
  const trimmed = query.trim()
  useEffect(() => {
    if (scope.length === 0 || trimmed.length === 0) return
    let cancelled = false
    const timer = setTimeout(() => {
      void (async () => {
        const lists = await Promise.all(scope.map((name) => searchWords(name, trimmed)))
        if (!cancelled) setResults(lists.flat())
      })()
    }, 150)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [trimmed, scope])

  const visible = trimmed.length === 0 || scope.length === 0 ? [] : results

  const openResult = (result: SearchResult) =>
    guardedPush(() =>
      router.push({
        pathname: '/mode/browse/[position]',
        params: { position: String(result.position), bucket: result.bucketName },
      }),
    )

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      <View className="gap-2 px-4 py-2 flex-row items-center">
        <Pressable
          className="w-8 items-start"
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color={MUTED[scheme]} />
        </Pressable>
        <View className="flex-1 justify-center">
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Search words"
            placeholderTextColor={MUTED[scheme]}
            autoCapitalize="none"
            autoCorrect={false}
            className="rounded-xl bg-gray-100 px-4 py-2.5 text-black dark:bg-gray-800 dark:text-white text-[17px]"
          />
        </View>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(result, i) => `${result.bucketName}-${result.position}-${i}`}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item }) => (
          <Pressable
            className="px-6 py-3 flex-row items-center"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            onPress={() => openResult(item)}
          >
            <Text
              className="w-11 text-gray-400 dark:text-gray-500 text-[13px]"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {item.position}
            </Text>
            <Text numberOfLines={1} className="text-black dark:text-white flex-1 text-[17px]">
              {item.word}
            </Text>
            <Text
              className="ml-2 text-gray-400 dark:text-gray-500 text-[13px]"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {item.bucketName}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          trimmed.length > 0 ? (
            <Text className="p-6 text-gray-400 dark:text-gray-500 text-[15px]">No matches</Text>
          ) : null
        }
      />
    </SafeAreaView>
  )
}

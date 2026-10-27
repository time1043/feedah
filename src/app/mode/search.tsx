import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useAtomValue } from 'jotai'
import { useEffect, useRef, useState } from 'react'
import { FlatList, Pressable, Text, TextInput, View, useColorScheme } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { activeBucketAtom, searchLocalAtom, searchScopeAtom } from '@/atoms/settings'
import { listBuckets, searchWords, type SearchResult } from '@/db/repo'

/**
 * Word lookup. Without a pinned bucket it spans the configured global scope
 * (all buckets by default); opened from the feed or a review it is pinned to
 * that bucket — unless local search is off, in which case the global scope
 * applies. When the opener was a review (round param), results open the
 * browse deck pinned to that round so flagging lands on the reviewed round.
 */
export default function SearchScreen() {
  const scheme = useColorScheme() ?? 'light'
  const tertiary = scheme === 'dark' ? '#7A7E86' : '#9A9EA6'
  const params = useLocalSearchParams<{ bucket?: string; round?: string }>()
  const activeName = useAtomValue(activeBucketAtom)
  const configuredScope = useAtomValue(searchScopeAtom)
  const localSearch = useAtomValue(searchLocalAtom)

  const pinnedBucket = typeof params.bucket === 'string' && params.bucket ? params.bucket : ''
  const pinnedRound = Number(params.round)

  const [scope, setScope] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const inputRef = useRef<TextInput | null>(null)
  // Double taps would stack two browse decks.
  const navigating = useRef(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (pinnedBucket && localSearch) {
        if (!cancelled) setScope([pinnedBucket])
        return
      }
      const scopeIds =
        configuredScope.length > 0 ? configuredScope : (await listBuckets()).map((b) => b.id)
      if (!cancelled) setScope(scopeIds)
    })()
    return () => {
      cancelled = true
    }
  }, [pinnedBucket, localSearch, configuredScope])

  useEffect(() => {
    const trimmed = query.trim()
    if (scope.length === 0 || trimmed.length === 0) {
      setResults([])
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      void (async () => {
        const lists = await Promise.all(scope.map((id) => searchWords(id, trimmed)))
        if (!cancelled) setResults(lists.flat())
      })()
    }, 150)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, scope])

  const openResult = (result: SearchResult) => {
    if (navigating.current) return
    navigating.current = true
    router.push({
      pathname: '/mode/browse/[position]',
      params: {
        position: String(result.position),
        bucket: result.bucketId,
        ...(Number.isInteger(pinnedRound) && pinnedRound > 0 ? { round: String(pinnedRound) } : {}),
      },
    })
    setTimeout(() => {
      navigating.current = false
    }, 500)
  }

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      <View className="gap-2 px-4 py-2 flex-row items-center">
        <Pressable
          className="w-8 items-start"
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color={tertiary} />
        </Pressable>
        <View className="flex-1 justify-center">
          <TextInput
            ref={inputRef}
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Search words"
            placeholderTextColor={tertiary}
            autoCapitalize="none"
            autoCorrect={false}
            className="rounded-xl bg-gray-100 px-4 py-2.5 text-black dark:bg-gray-800 dark:text-white text-[17px]"
          />
        </View>
      </View>

      <FlatList
        data={results}
        keyExtractor={(result, i) => `${result.bucketId}-${result.position}-${i}`}
        keyboardShouldPersistTaps="handled"
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
              {item.bucketId}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          query.length > 0 ? (
            <Text className="p-6 text-gray-400 dark:text-gray-500 text-[15px]">No matches</Text>
          ) : null
        }
      />
    </SafeAreaView>
  )
}

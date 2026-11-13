import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useAtomValue } from 'jotai'
import { useEffect, useState, type ReactNode } from 'react'
import { FlatList, Pressable, Text, TextInput, View, useColorScheme } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { searchLocalAtom, searchScopeAtom } from '@/atoms/settings'
import { MUTED } from '@/components/header'
import { getBuckets } from '@/db/repo/bucket-word'
import { searchWords, type SearchResult } from '@/db/repo/search'
import { LIME } from '@/lib/color'
import { useNavGuard } from '@/lib/use-nav-guard'

/**
 * Paints the query's hits inside the word in the accent green — the result
 * shows WHY it matched. Wildcard queries (`%`, `_`, `|`) don't map to plain
 * substrings, so they render unpainted.
 */
function HighlightedWord({ word, query }: { word: string; query: string }) {
  const plain = (
    <Text numberOfLines={1} className="text-black dark:text-white flex-1 text-[17px]">
      {word}
    </Text>
  )
  const needle = query.trim().toLowerCase()
  if (needle.length === 0 || /[%_\\|]/.test(needle)) return plain

  const parts: ReactNode[] = []
  const lower = word.toLowerCase()
  let cursor = 0
  let index = lower.indexOf(needle)
  while (index !== -1) {
    if (index > cursor) parts.push(word.slice(cursor, index))
    parts.push(
      <Text key={`${index}`} className="font-bold text-accent-deep dark:text-accent">
        {word.slice(index, index + needle.length)}
      </Text>,
    )
    cursor = index + needle.length
    index = lower.indexOf(needle, cursor)
  }
  if (cursor < word.length) parts.push(word.slice(cursor))
  return (
    <Text numberOfLines={1} className="text-black dark:text-white flex-1 text-[17px]">
      {parts}
    </Text>
  )
}

/** One scope chip: the lime pill when active, the quiet outline when not. */
function ScopeChip({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`px-4 py-2 rounded-full ${
        active ? 'bg-accent' : 'border-gray-300 dark:border-gray-700 border'
      }`}
    >
      <Text
        className={`font-bold text-[15px] ${
          active ? 'text-black' : 'text-gray-500 dark:text-gray-300'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  )
}

/**
 * Word lookup. Without a pinned bucket it spans the configured global scope
 * (all buckets by default); opened from a deck or a review it is pinned to
 * that bucket, and the chips under the field switch — this visit only —
 * between the bucket and everyone. Results open the browse deck pinned to
 * their bucket, so flagging lands in the right round.
 */
export default function SearchScreen() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  const params = useLocalSearchParams<{ bucket?: string }>()
  const configuredScope = useAtomValue(searchScopeAtom)
  const localSearch = useAtomValue(searchLocalAtom)

  const pinnedBucket = typeof params.bucket === 'string' && params.bucket ? params.bucket : ''

  // The pinned bucket's scope, per visit like the word list's eye: it starts
  // from the stored setting and a tap overrides it for this visit only.
  const [override, setOverride] = useState<boolean | null>(null)
  const inBucket = pinnedBucket ? (override ?? localSearch) : false

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
      const names = pinnedBucket && inBucket ? [pinnedBucket] : all
      if (!cancelled) setScope(names)
    })()
    return () => {
      cancelled = true
    }
  }, [pinnedBucket, inBucket, configuredScope])

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
        {/* The prototype's field: the lime ring with the lens inside. */}
        <View className="gap-2 rounded-2xl border-accent bg-gray-100 px-3.5 dark:bg-surface flex-1 flex-row items-center border-2">
          <Ionicons name="search" size={18} color={MUTED[scheme]} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Search words"
            placeholderTextColor={MUTED[scheme]}
            autoCapitalize="none"
            autoCorrect={false}
            selectionColor={LIME}
            className="py-2.5 text-black dark:text-white flex-1 text-[17px]"
          />
        </View>
      </View>

      {pinnedBucket ? (
        <View className="gap-2 px-4 pb-2 pt-1 flex-row">
          <ScopeChip label="All buckets" active={!inBucket} onPress={() => setOverride(false)} />
          <ScopeChip
            label={`In ${pinnedBucket}`}
            active={inBucket}
            onPress={() => setOverride(true)}
          />
        </View>
      ) : null}

      <FlatList
        data={visible}
        keyExtractor={(result, i) => `${result.bucketName}-${result.position}-${i}`}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item }) => (
          <Pressable
            className="border-gray-200 px-6 py-3.5 dark:border-gray-800 flex-row items-center border-b"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            onPress={() => openResult(item)}
          >
            <Text
              className="w-11 text-gray-400 dark:text-gray-500 text-[13px]"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {item.position}
            </Text>
            <HighlightedWord word={item.word} query={trimmed} />
            <Text
              className="ml-2 text-gray-400 dark:text-gray-500 text-[13px]"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {item.bucketName}
            </Text>
          </Pressable>
        )}
        ListFooterComponent={
          visible.length > 0 ? (
            <Text className="p-6 text-gray-400 dark:text-gray-500 text-[15px]">
              Tap a result to open it in Browse.
            </Text>
          ) : null
        }
        ListEmptyComponent={
          trimmed.length > 0 ? (
            <Text className="p-6 text-gray-400 dark:text-gray-500 text-[15px]">No matches</Text>
          ) : null
        }
      />
    </SafeAreaView>
  )
}

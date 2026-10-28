import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useAtomValue } from 'jotai'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, Pressable, Text, TextInput, View, useColorScheme } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { onSearchReset } from '@/lib/search-reset'
import { searchWords } from '@/lib/search'
import { buckets, findBucketByName } from '@/mock/data'
import { activeBucketAtom } from '@/atoms/study'
import { currentRound } from '@/study/logic'
import { bucketLocalSearchAtom, globalSearchBucketsAtom } from '@/study/settings'
import { useStudyState } from '@/study/store'
import type { Word } from '@/types/word'

interface SearchHit extends Word {
  bucketId: string
}

/**
 * Word search. The scope follows the opener: from inside a bucket context
 * (when local search is enabled) it covers that bucket only, otherwise the
 * configured global scope. Matching covers the headword, the inflected forms
 * and the Chinese meaning, with % / _ wildcards (see lib/search).
 *
 * Results open in the browse deck; a flagRound param pins which round's flag
 * list the browser edits, so a review session can pull new words in.
 */
export default function SearchScreen() {
  const scheme = useColorScheme() ?? 'light'
  const iconColor = scheme === 'dark' ? '#7A7E86' : '#9A9EA6'
  const { bucket: bucketParam, flagRound: flagRoundParam } = useLocalSearchParams<{
    bucket?: string
    flagRound?: string
  }>()
  const activeName = useAtomValue(activeBucketAtom)
  const globalScope = useAtomValue(globalSearchBucketsAtom)
  const localSearch = useAtomValue(bucketLocalSearchAtom)
  const state = useStudyState()

  const [query, setQuery] = useState('')
  const inputRef = useRef<TextInput>(null)
  const navigating = useRef(false)

  // The word browser's search icon signals "back to searching": clear and
  // refocus so the next query starts fresh.
  useEffect(
    () =>
      onSearchReset(() => {
        setQuery('')
        inputRef.current?.focus()
      }),
    [],
  )

  // A pinned bucket searches locally when the setting allows; everything
  // else falls back to the configured global scope.
  const pinned = bucketParam ?? activeName
  const local = bucketParam != null && localSearch
  const scopes = local ? [pinned] : (globalScope ?? buckets.map((bucket) => bucket.name))
  const flagRound = flagRoundParam ? Number(flagRoundParam) : null

  const hits: SearchHit[] = useMemo(() => {
    const trimmed = query.trim()
    if (trimmed.length === 0) return []
    return scopes.flatMap((name) =>
      searchWords(findBucketByName(name).words, trimmed).map((word) => ({
        ...word,
        bucketId: name,
      })),
    )
  }, [query, scopes])

  // The red dot shows the list a flag would land in from here: the pinned
  // round when set, else each bucket's current one.
  const flagTargetRound = (bucketId: string): number =>
    flagRound ?? (state ? currentRound(state, bucketId) : 1)

  const openHit = (hit: SearchHit) => {
    if (navigating.current) return
    navigating.current = true
    router.push({
      pathname: '/mode/browse/[position]',
      params: {
        position: String(hit.position),
        bucket: hit.bucketId,
        from: 'search',
        ...(flagRound != null ? { flagRound: String(flagRound) } : {}),
      },
    })
    setTimeout(() => {
      navigating.current = false
    }, 500)
  }

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      <View className="min-h-11 px-4 py-2 flex-row items-center gap-2">
        <Pressable className="w-8 items-start" onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={iconColor} />
        </Pressable>
        <TextInput
          ref={inputRef}
          className="text-black dark:text-white flex-1 text-[17px]"
          placeholder="Search word, form or meaning"
          placeholderTextColor={iconColor}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          accessibilityLabel="Search query"
        />
        {query.length > 0 && (
          <Pressable
            className="w-8 items-end"
            hitSlop={12}
            accessibilityLabel="Clear query"
            onPress={() => setQuery('')}
          >
            <Ionicons name="close-circle" size={20} color={iconColor} />
          </Pressable>
        )}
      </View>

      <FlatList
        data={hits}
        keyExtractor={(hit) => `${hit.bucketId}:${hit.position}`}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openHit(item)}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <View className="border-gray-200 px-4 dark:border-gray-800 h-12 flex-row items-center border-b">
              <Text
                className="w-10 text-gray-400 dark:text-gray-500 text-[13px]"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {item.position}
              </Text>
              {state && roundFlagged(state, item, flagTargetRound(item.bucketId)) && (
                <View className="mr-1.5 h-1.5 w-1.5 rounded-sm bg-red-500" />
              )}
              <Text
                numberOfLines={1}
                className="font-semibold text-black dark:text-white mr-2 flex-[2] text-[15px]"
              >
                {item.word}
              </Text>
              <Text numberOfLines={1} className="text-gray-400 dark:text-gray-500 flex-1 text-[13px]">
                {item.meaning}
              </Text>
              {!local && (
                <Text className="ml-2 text-gray-400 dark:text-gray-500 text-[12px]">
                  {item.bucketId}
                </Text>
              )}
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          query.trim().length > 0 ? (
            <Text className="text-gray-400 dark:text-gray-500 p-8 text-center text-[15px]">
              No matches
            </Text>
          ) : null
        }
      />
    </SafeAreaView>
  )
}

function roundFlagged(
  state: NonNullable<ReturnType<typeof useStudyState>>,
  hit: SearchHit,
  round: number,
): boolean {
  return state.roundWords[hit.bucketId]?.[round]?.[hit.position]?.flagged ?? false
}

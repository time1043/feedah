import { useFocusEffect } from 'expo-router'
import { useAtom } from 'jotai'
import { useCallback, useState } from 'react'
import { Pressable, ScrollView, Switch, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  hudPageAtom,
  hudRoundAtom,
  searchLocalAtom,
  searchScopeAtom,
  wordsMeaningAtom,
} from '@/atoms/settings'
import { listBuckets } from '@/db/repo'

/** Preferences: deck footers, word list display, search scope. */
export default function SettingsScreen() {
  const [showPage, setShowPage] = useAtom(hudPageAtom)
  const [showRound, setShowRound] = useAtom(hudRoundAtom)
  const [showMeaning, setShowMeaning] = useAtom(wordsMeaningAtom)
  const [localSearch, setLocalSearch] = useAtom(searchLocalAtom)
  const [scope, setScope] = useAtom(searchScopeAtom)
  const [bucketIds, setBucketIds] = useState<string[]>([])

  useFocusEffect(
    useCallback(() => {
      void listBuckets().then((rows) => setBucketIds(rows.map((row) => row.id)))
    }, []),
  )

  // An empty scope means every bucket; the picker keeps it explicit once touched.
  const includes = (id: string) => scope.length === 0 || scope.includes(id)
  const toggleScope = (id: string) => {
    const all = bucketIds.filter((entry) => entry !== id)
    if (includes(id)) {
      const remaining = (scope.length === 0 ? all : scope).filter((entry) => entry !== id)
      setScope(remaining)
    } else {
      setScope([...scope, id])
    }
  }

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="p-4 pb-2 font-bold text-black dark:text-white text-[22px]">Settings</Text>
        <View className="gap-1 px-4">
          <SettingRow
            label="Page number"
            hint="Current position of the deck, bottom right"
            value={showPage}
            onChange={setShowPage}
          />
          <SettingRow
            label="Round / time"
            hint="Current feed round or review pass, bottom left"
            value={showRound}
            onChange={setShowRound}
          />
          <SettingRow
            label="Word meanings"
            hint="Show the meaning column in the word list"
            value={showMeaning}
            onChange={setShowMeaning}
          />
          <SettingRow
            label="Local search"
            hint="Search opened from a bucket stays inside it"
            value={localSearch}
            onChange={setLocalSearch}
          />
        </View>

        <View className="gap-2 px-4 pt-6">
          <Text className="font-semibold text-black dark:text-white text-[15px]">
            Global search scope
          </Text>
          <Text className="text-gray-500 dark:text-gray-400 text-[13px]">
            Buckets searched when no single bucket is pinned.{'\n'}
            Current: {scope.length === 0 ? 'all buckets' : scope.join(', ')}
          </Text>
          <View className="mt-1 gap-2 flex-row flex-wrap">
            {bucketIds.map((id) => (
              <Pressable
                key={id}
                onPress={() => toggleScope(id)}
                className={`px-4 py-2 rounded-full border ${
                  includes(id)
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                    : 'border-gray-300 dark:border-gray-700'
                }`}
              >
                <Text
                  className={`text-[13px] ${
                    includes(id)
                      ? 'font-semibold text-blue-500'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {id}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function SettingRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <View className="border-gray-200 py-3 dark:border-gray-800 flex-row items-center justify-between border-b">
      <View className="pr-4 flex-1">
        <Text className="font-semibold text-black dark:text-white text-[15px]">{label}</Text>
        <Text className="mt-0.5 text-gray-500 dark:text-gray-400 text-[13px]">{hint}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} />
    </View>
  )
}

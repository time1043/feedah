import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useAtom } from 'jotai'
import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { searchScopeAtom, studyModeAtom } from '@/atoms/settings'
import { listBuckets } from '@/db/repo'
import { STUDY_MODES } from '@/study/modes'

/**
 * Settings for the bucket list itself: the default study mode its cards
 * launch with, and which buckets take part in global search.
 */
export default function BucketSettingsScreen() {
  const [studyMode, setStudyMode] = useAtom(studyModeAtom)
  const [scope, setScope] = useAtom(searchScopeAtom)
  const [allIds, setAllIds] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    void listBuckets().then((rows) => {
      if (!cancelled) setAllIds(rows.map((row) => row.id))
    })
    return () => {
      cancelled = true
    }
  }, [])

  // An empty scope means every bucket is included; the picker keeps it
  // explicit once the user touches it.
  const includes = (id: string) => scope.length === 0 || scope.includes(id)
  const toggleScope = (id: string) => {
    const all = allIds.filter((entry) => entry !== id)
    if (includes(id)) {
      setScope((scope.length === 0 ? all : scope).filter((entry) => entry !== id))
    } else {
      setScope([...scope, id])
    }
  }

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      {/* header */}
      <View className="min-h-11 px-4 py-2 flex-row items-center">
        <Pressable
          className="w-8 items-start"
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color="#9A9EA6" />
        </Pressable>
        <Text className="font-semibold text-black dark:text-white flex-1 text-center text-[17px]">
          Bucket settings
        </Text>
        <View className="w-8" />
      </View>

      {/* Default study mode */}
      <View className="px-4 pt-2">
        <Text className="font-semibold text-black dark:text-white text-[15px]">
          Default study mode
        </Text>
        <Text className="mt-1 text-gray-500 dark:text-gray-400 text-[13px]">
          Used by Continue on the home screen.
        </Text>
        <View className="mt-3 gap-2 flex-row">
          {STUDY_MODES.map((mode) => (
            <Pressable
              key={mode.id}
              onPress={() => setStudyMode(mode.id)}
              className={`rounded-lg p-2.5 flex-1 items-center border ${
                mode.id === studyMode
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                  : 'border-gray-300 dark:border-gray-700'
              }`}
            >
              <Text
                className={`font-semibold text-[13px] ${
                  mode.id === studyMode ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {mode.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Global search scope */}
      <View className="px-4 pt-8">
        <Text className="font-semibold text-black dark:text-white text-[15px]">
          Global search scope
        </Text>
        <Text className="mt-1 text-gray-500 dark:text-gray-400 text-[13px]">
          Buckets searched when no single bucket is pinned. Current:{' '}
          {scope.length === 0 ? 'all buckets' : scope.join(', ')}
        </Text>
        <View className="mt-3 gap-2 flex-row flex-wrap">
          {allIds.map((id) => (
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
                  includes(id) ? 'font-semibold text-blue-500' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {id}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </SafeAreaView>
  )
}

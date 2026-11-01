import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useState } from 'react'
import { Pressable, Switch, Text, View, useColorScheme } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { activeBucketAtom, searchScopeAtom, studyModeAtom } from '@/atoms/settings'
import { countRoundFlags, getProgress, listBuckets } from '@/db/repo'
import { STUDY_MODES } from '@/study/modes'

/**
 * This bucket's own settings: the study mode its Continue launches with,
 * the launch/review actions, and whether it takes part in global search.
 */
export default function BucketSettingsScreen() {
  const scheme = useColorScheme() ?? 'light'
  const muted = scheme === 'dark' ? '#7A7E86' : '#9A9EA6'
  const { name } = useLocalSearchParams<{ name: string }>()
  const bucketName = Array.isArray(name) ? name[0] : name

  const activeName = useAtomValue(activeBucketAtom)
  const setActiveName = useSetAtom(activeBucketAtom)
  const [studyMode, setStudyMode] = useAtom(studyModeAtom)
  const [scope, setScope] = useAtom(searchScopeAtom)

  const [progress, setProgress] = useState({ round: 1, pointer: 0 })
  const [flagCount, setFlagCount] = useState(0)
  const [allIds, setAllIds] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const probe = await getProgress(bucketName)
      const count = await countRoundFlags(bucketName, probe.round)
      const rows = await listBuckets()
      if (cancelled) return
      setProgress(probe)
      setFlagCount(count)
      setAllIds(rows.map((row) => row.id))
    })()
    return () => {
      cancelled = true
    }
  }, [bucketName])

  // An empty scope means every bucket is included; turning one off from
  // "all" makes the rest the explicit list.
  const included = scope.length === 0 || scope.includes(bucketName)
  const setIncluded = (on: boolean) => {
    if (on) {
      setScope((prev) => (prev.includes(bucketName) ? prev : [...prev, bucketName]))
    } else {
      const current = scope.length === 0 ? allIds : scope
      setScope(current.filter((id) => id !== bucketName))
    }
  }

  const launch = () => {
    setActiveName(bucketName)
    router.push({
      pathname: '/mode/study/[mode]',
      params: { mode: studyMode, bucket: bucketName },
    })
  }
  const started = progress.pointer > 0 || progress.round > 1

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
          <Ionicons
            name="chevron-back"
            size={24}
            color={scheme === 'dark' ? '#7A7E86' : '#9A9EA6'}
          />
        </Pressable>
        <Text className="font-semibold text-black dark:text-white flex-1 text-center text-[17px]">
          {bucketName} settings
        </Text>
        <View className="w-8" />
      </View>

      {/* Study */}
      <View className="px-4 pt-4">
        <Text className="font-semibold text-black dark:text-white text-[15px]">Study</Text>
        <Text className="mt-1 text-gray-500 dark:text-gray-400 text-[13px]">
          The mode this bucket's Continue launches with.
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
        <View className="mt-3 gap-2 flex-row">
          <Pressable className="rounded-xl bg-blue-500 p-4 flex-1 items-center" onPress={launch}>
            <Text className="font-bold text-white">{started ? 'Continue' : 'Start'}</Text>
          </Pressable>
          <Pressable
            disabled={flagCount === 0}
            className="rounded-xl border-blue-500 p-4 flex-1 items-center border-2 disabled:opacity-40"
            onPress={() => router.push('/mode/review')}
          >
            <Text className="font-semibold text-blue-500">Review · {flagCount}</Text>
          </Pressable>
        </View>
      </View>

      {/* Search */}
      <View className="px-4 pt-8">
        <Text className="font-semibold text-black dark:text-white text-[15px]">Search</Text>
        <View className="mt-2 border-gray-200 py-3 dark:border-gray-800 flex-row items-center justify-between border-b">
          <View className="pr-4 flex-1">
            <Text className="text-black dark:text-white text-[15px]">Include in global search</Text>
            <Text className="mt-0.5 text-gray-500 dark:text-gray-400 text-[13px]">
              Off = this bucket is only reachable from its own entries.
            </Text>
          </View>
          <Switch value={included} onValueChange={setIncluded} />
        </View>
      </View>
    </SafeAreaView>
  )
}

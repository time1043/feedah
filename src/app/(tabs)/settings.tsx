import { useAtom } from 'jotai'
import { Pressable, ScrollView, Switch, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { buckets } from '@/mock/data'
import {
  bucketLocalSearchAtom,
  globalSearchBucketsAtom,
  studyReadoutsAtom,
  wordsMeaningAtom,
} from '@/study/settings'

/**
 * Preferences. The search section configures scope: whether searching from
 * inside a bucket stays inside it, and which buckets the global search
 * covers (once user-imported buckets exist they join this list).
 */
export default function SettingsScreen() {
  const [readouts, setReadouts] = useAtom(studyReadoutsAtom)
  const [wordsMeaning, setWordsMeaning] = useAtom(wordsMeaningAtom)
  const [localSearch, setLocalSearch] = useAtom(bucketLocalSearchAtom)
  const [globalScope, setGlobalScope] = useAtom(globalSearchBucketsAtom)

  const allNames = buckets.map((bucket) => bucket.name)
  // null means "every bucket"; the first toggle pins an explicit list.
  const included = new Set(globalScope ?? allNames)

  const toggleGlobalBucket = (name: string) => {
    const next = new Set(globalScope ?? allNames)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    // An empty scope would silence the global search entirely; treat it as
    // the unfiltered default instead of storing it.
    setGlobalScope(next.size === 0 ? null : [...next])
  }

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      <ScrollView contentContainerStyle={{ gap: 16, padding: 16 }}>
        <Text className="font-bold text-black dark:text-white text-[22px]">Settings</Text>

        <Section title="Study">
          <ToggleRow
            title="Study readouts"
            detail="Round/time and position at the bottom corners"
            value={readouts}
            onChange={setReadouts}
          />
          <ToggleRow
            title="Word list meanings"
            detail="Show the meaning column in word lists"
            value={wordsMeaning}
            onChange={setWordsMeaning}
          />
        </Section>

        <Section title="Search">
          <ToggleRow
            title="Search inside buckets"
            detail="Searching from feed, review or browse covers that bucket only"
            value={localSearch}
            onChange={setLocalSearch}
          />
          <View className="gap-1 px-1 pt-1">
            <Text className="text-gray-500 dark:text-gray-400 text-[13px]">
              Global search scope
            </Text>
            {buckets.map((bucket) => (
              <Pressable
                key={bucket.name}
                className="py-2 flex-row items-center justify-between"
                onPress={() => toggleGlobalBucket(bucket.name)}
              >
                <Text className="text-black dark:text-white text-[15px]">{bucket.name}</Text>
                <Text
                  className={`text-[13px] ${included.has(bucket.name) ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'}`}
                >
                  {included.has(bucket.name) ? 'included' : 'excluded'}
                </Text>
              </Pressable>
            ))}
          </View>
        </Section>

        <Text className="text-gray-400 dark:text-gray-500 text-[12px]">feedah · mock data</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="text-gray-500 dark:text-gray-400 text-[13px]">{title}</Text>
      <View className="rounded-2xl border-gray-200 dark:border-gray-800 gap-1 p-1 border">
        {children}
      </View>
    </View>
  )
}

function ToggleRow({
  title,
  detail,
  value,
  onChange,
}: {
  title: string
  detail: string
  value: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <View className="p-3 gap-3 flex-row items-center">
      <View className="flex-1">
        <Text className="text-black dark:text-white text-[15px]">{title}</Text>
        <Text className="text-gray-400 dark:text-gray-500 text-[12px]">{detail}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} />
    </View>
  )
}

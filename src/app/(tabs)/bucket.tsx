import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useColorScheme, Pressable, Text, View } from 'react-native'

import { MUTED, TabHeader } from '@/components/header'
import { useNavGuard } from '@/lib/use-nav-guard'
import { buckets } from '@/mock/bucket'

/** The bucket tab: one clean card per mock bucket — name plus word count.
 * The card's body opens the word list; its side opens the round list. The
 * reference's progress readout, import, delete and settings page all wait
 * for the session and the db. */
export default function BucketScreen() {
  const dark = useColorScheme() === 'dark'
  const guardedPush = useNavGuard()

  return (
    <View className="bg-white dark:bg-black flex-1">
      <TabHeader title="Bucket" />
      {buckets.map((bucket) => (
        <View
          key={bucket.name}
          className="mx-4 mb-3 rounded-2xl border-gray-300 dark:border-gray-700 flex-row items-stretch border"
        >
          {/* Body: the bucket's word list. */}
          <Pressable
            className="p-4 flex-1 flex-row items-center justify-between"
            accessibilityRole="button"
            accessibilityLabel={`${bucket.name}, ${bucket.words.length} words`}
            onPress={() =>
              guardedPush(() =>
                router.push({ pathname: '/bucket/words/[name]', params: { name: bucket.name } }),
              )
            }
          >
            <Text className="font-semibold text-black dark:text-white text-[17px]">
              {bucket.name}
            </Text>
            <Text
              className="text-gray-500 dark:text-gray-400 text-[13px]"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {bucket.words.length} words
            </Text>
          </Pressable>
          {/* Side: the round list. */}
          <Pressable
            className="w-14 items-center justify-center"
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={`Rounds of ${bucket.name}`}
            onPress={() =>
              guardedPush(() =>
                router.push({ pathname: '/bucket/rounds/[name]', params: { name: bucket.name } }),
              )
            }
          >
            <Ionicons name="repeat" size={20} color={MUTED[dark ? 'dark' : 'light']} />
          </Pressable>
        </View>
      ))}
    </View>
  )
}

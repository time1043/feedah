import { router } from 'expo-router'
import { Pressable, Text, View } from 'react-native'

import { TabHeader } from '@/components/header'
import { useNavGuard } from '@/lib/use-nav-guard'
import { buckets } from '@/mock/bucket'

/** The bucket tab: one clean card per mock bucket — name plus word count.
 * Tapping a card opens the bucket's word list. The reference's progress
 * readout, import, delete and rounds entry all wait for the session and the
 * db. */
export default function BucketScreen() {
  const guardedPush = useNavGuard()

  return (
    <View className="bg-white dark:bg-black flex-1">
      <TabHeader title="Bucket" />
      {buckets.map((bucket) => (
        <Pressable
          key={bucket.name}
          className="mx-4 mb-3 rounded-2xl border-gray-300 p-4 dark:border-gray-700 flex-row items-center justify-between border"
          onPress={() =>
            guardedPush(() =>
              router.push({ pathname: '/words/[name]', params: { name: bucket.name } }),
            )
          }
          accessibilityRole="button"
          accessibilityLabel={`${bucket.name}, ${bucket.words.length} words`}
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
      ))}
    </View>
  )
}

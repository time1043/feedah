import { router } from 'expo-router'
import { useAtomValue } from 'jotai'
import { useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'

import { activeBucketAtom } from '@/atoms/bucket'
import { findBucketByName } from '@/mock/bucket'

export default function Index() {
  const activeName = useAtomValue(activeBucketAtom)
  // The browse box takes the CARD NUMBER (the data position printed on the
  // card); default it to the bucket's first card so the first press works.
  const [position, setPosition] = useState(
    String(findBucketByName(activeName).words[0]?.position ?? ''),
  )

  return (
    <View className="gap-6 bg-white p-6 dark:bg-black flex-1 items-center justify-center">
      <View className="max-w-sm gap-3 w-full">
        <Text className="font-semibold text-black dark:text-white">Navigation</Text>

        <View className="gap-2 flex-row items-center">
          <TextInput
            className="min-w-0 rounded-lg border-gray-300 p-3 text-black dark:border-gray-700 dark:text-white flex-1 border"
            keyboardType="numeric"
            value={position}
            onChangeText={setPosition}
            placeholder="Position"
            placeholderTextColor="#9ca3af"
          />

          <Pressable
            className="rounded-lg bg-blue-500 px-5 py-3"
            onPress={() =>
              router.push({
                pathname: '/mode/browse/[position]',
                params: { position },
              })
            }
          >
            <Text className="font-medium text-white">Browse</Text>
          </Pressable>
        </View>

        <Pressable
          className="rounded-lg border-gray-300 p-3 dark:border-gray-700 border"
          onPress={() => router.push('/mode/study')}
        >
          <Text className="text-black dark:text-white">Study</Text>
        </Pressable>

        <Pressable
          className="rounded-lg border-gray-300 p-3 dark:border-gray-700 border"
          onPress={() => router.push('/mode/review')}
        >
          <Text className="text-black dark:text-white">Review</Text>
        </Pressable>

        <Pressable
          className="rounded-lg border-gray-300 p-3 dark:border-gray-700 border"
          onPress={() => router.push('/mode/search')}
        >
          <Text className="text-black dark:text-white">Search</Text>
        </Pressable>
      </View>
    </View>
  )
}

import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'

import ThemeToggle from '@/components/theme-toggle'

export default function Index() {
  const [position, setPosition] = useState('0')

  return (
    <View className="gap-6 bg-white p-6 dark:bg-black flex-1 items-center justify-center">
      <Text className="text-xl font-bold text-blue-500">Welcome to Nativewind!</Text>

      <ThemeToggle />

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
          onPress={() => router.push('/mode/feed')}
        >
          <Text className="text-black dark:text-white">Feed</Text>
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

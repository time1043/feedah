import { Text, View } from 'react-native'

import type { Word } from '@/types/bucket'

type WordCardProps = {
  word: Word
}

export function WordCard({ word }: WordCardProps) {
  return (
    <View className="px-8 flex-1 items-center justify-center">
      <Text
        className="mb-4 font-semibold text-gray-500 dark:text-gray-400 text-[28px]"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {word.position}
      </Text>

      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
        className="font-extrabold text-black dark:text-white text-center text-[48px]"
      >
        {word.word}
      </Text>

      {word.ipa.length > 0 && (
        <Text className="mt-2 text-lg text-gray-400 dark:text-gray-500 text-center">
          {word.ipa}
        </Text>
      )}

      {word.meaning.length > 0 && (
        <Text className="mt-6 text-xl text-gray-500 dark:text-gray-400 text-center">
          {word.meaning}
        </Text>
      )}

      {word.forms.length > 0 && (
        <View className="mt-8 w-full flex-row flex-wrap justify-center">
          {word.forms.map((form) => (
            <View key={form} className="mb-2 px-2 w-1/2">
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                className="text-gray-400 dark:text-gray-500 text-[13px]"
              >
                {form}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

import { Text, View } from 'react-native'

import type { Word } from '@/types/bucket'

// Word forms render in a fixed 2×6 grid (12 cells); empty cells keep the
// layout, so the forms block is the same size on every card and never shifts.
const FORMS_GRID_CELLS = 12

type WordCardProps = {
  word: Word
}

/**
 * The full-screen word card, split into two fixed halves — the project's
 * layout convention, so nothing jitters as content changes:
 *   - top 50%: position, the word, the ipa, and a fixed-height slot for the
 *     meaning. The headword stays anchored whether the meaning runs one
 *     line or three.
 *   - bottom 50%: the supplementary word forms, in the fixed grid.
 */
export function WordCard({ word }: WordCardProps) {
  return (
    <View className="flex-1">
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

        {/* Reserved slot: keeps number and word anchored while the meaning
            toggles or wraps. */}
        <View className="mt-4 h-[110px] items-center justify-start">
          {word.meaning.length > 0 && (
            <Text className="text-xl text-gray-500 dark:text-gray-400 text-center">
              {word.meaning}
            </Text>
          )}
        </View>
      </View>

      <View className="px-8 flex-1 items-center justify-center">
        {word.forms.length > 0 && (
          <View className="mb-6 w-full flex-row flex-wrap">
            {Array.from({ length: FORMS_GRID_CELLS }).map((_, i) => (
              <View key={i} className="mb-2 h-7 px-2 w-1/2 justify-center">
                {word.forms[i] != null && (
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    className="text-gray-400 dark:text-gray-500 text-[13px]"
                  >
                    {word.forms[i]}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  )
}

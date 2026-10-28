import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { Pressable, Text, View, useColorScheme } from 'react-native'

import { meaningLines } from '@/lib/meaning'

// Word forms render in a fixed 2×6 grid (12 cells); empty cells keep the
// layout, so the card height is constant across words.
const FORMS_GRID_CELLS = 12

type WordCardProps = {
  position: number
  text: string
  meaning: string
  forms: string[]
  ipa?: string
  flagged: boolean
  onReplay: () => void
  onToggleFlag: () => void
}

/**
 * The full-screen word card, split into two independent halves so toggling
 * the meaning never shifts anything:
 *   - top: position number, the word, and a fixed-height slot for the meaning
 *   - bottom: supplementary word forms, shown together with the meaning
 * Tap the word to replay it; tap anywhere else to reveal/hide the meaning;
 * tap the bookmark to flag the word as unfamiliar.
 */
export function WordCard({
  position,
  text,
  meaning,
  forms,
  ipa,
  flagged,
  onReplay,
  onToggleFlag,
}: WordCardProps) {
  const scheme = useColorScheme() ?? 'light'
  const [revealed, setRevealed] = useState(false)
  const lines = meaningLines(meaning)

  return (
    <View className="flex-1">
      <Pressable
        className="px-8 flex-1 items-center justify-center"
        onPress={() => setRevealed((value) => !value)}
      >
        <Text
          className="mb-4 font-semibold text-gray-500 dark:text-gray-400 text-[28px]"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {position}
        </Text>
        <Pressable onPress={onReplay} hitSlop={12}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
            className="font-extrabold text-black dark:text-white text-center text-[48px]"
          >
            {text}
          </Text>
        </Pressable>
        {ipa && ipa.length > 0 && (
          <Text className="mt-2 text-lg text-gray-400 dark:text-gray-500 text-center">{ipa}</Text>
        )}
        {/* Reserved slot: keeps number and word anchored while meaning toggles. */}
        <View className="mt-4 h-[110px] items-center justify-start">
          {revealed &&
            meaning.length > 0 &&
            (lines ? (
              <View className="gap-2 items-center">
                {lines.map((line, i) => (
                  <Text key={i} className="text-xl text-gray-500 dark:text-gray-400 text-center">
                    {line}
                  </Text>
                ))}
              </View>
            ) : (
              <Text className="text-xl text-gray-500 dark:text-gray-400 text-center">
                {meaning}
              </Text>
            ))}
        </View>
      </Pressable>

      <Pressable
        className="px-8 flex-1 items-center justify-center"
        onPress={() => setRevealed((value) => !value)}
      >
        {revealed && forms.length > 0 && (
          <View className="mb-6 w-full flex-row flex-wrap">
            {Array.from({ length: FORMS_GRID_CELLS }).map((_, i) => (
              <View key={i} className="mb-2 h-7 px-2 w-1/2 justify-center">
                {forms[i] != null && (
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    className="text-gray-400 dark:text-gray-500 text-[13px]"
                  >
                    {forms[i]}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
      </Pressable>

      {/* Only the bookmark itself toggles the flag: the wrapper passes taps
          outside it through to the meaning toggles underneath. */}
      <View className="bottom-8 left-0 right-0 absolute items-center" pointerEvents="box-none">
        <Pressable
          className="p-2"
          onPress={onToggleFlag}
          hitSlop={8}
          accessibilityLabel={flagged ? 'Unflag word' : 'Flag word'}
        >
          <Ionicons
            name={flagged ? 'bookmark' : 'bookmark-outline'}
            size={30}
            color={flagged ? '#E5484D' : scheme === 'dark' ? '#7A7E86' : '#9A9EA6'}
          />
        </Pressable>
      </View>
    </View>
  )
}

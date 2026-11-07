import { Ionicons } from '@expo/vector-icons'
import { Pressable, Text, View, useColorScheme } from 'react-native'

import { meaningLines } from '@/lib/meaning'

// Word forms render in a fixed 2×6 grid (12 cells); empty cells keep the
// layout, so the card height is constant across words.
const FORMS_GRID_CELLS = 12

/** Position number, the big tappable word (replays pronunciation) and ipa.
 * Omit `text` to render the position alone (typing hides the word until it
 * is answered). */
export function CardHeadword({
  position,
  text,
  ipa,
  onReplay,
}: {
  position: number
  text?: string
  ipa?: string
  onReplay: () => void
}) {
  return (
    <>
      <Text
        className="mb-4 font-semibold text-gray-500 dark:text-gray-400 text-[28px]"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {position}
      </Text>
      {text !== undefined && text.length > 0 && (
        <>
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
        </>
      )}
    </>
  )
}

/** The meaning, one line per part-of-speech group when it is long. */
export function CardMeaning({ meaning }: { meaning: string }) {
  if (meaning.length === 0) return null
  const lines = meaningLines(meaning)
  return lines ? (
    <View className="gap-2 items-center">
      {lines.map((line, i) => (
        <Text key={i} className="text-xl text-gray-500 dark:text-gray-400 text-center">
          {line}
        </Text>
      ))}
    </View>
  ) : (
    <Text className="text-xl text-gray-500 dark:text-gray-400 text-center">{meaning}</Text>
  )
}

/** The supplementary forms grid, shown together with the meaning. */
export function CardForms({ forms }: { forms: string[] }) {
  if (forms.length === 0) return null
  return (
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
  )
}

/**
 * The bookmark, centered on the bottom edge. Only the icon itself toggles:
 * the wrapper passes taps beside it through (box-none) to whatever is
 * underneath the card.
 */
export function BookmarkButton({
  flagged,
  onToggleFlag,
}: {
  flagged: boolean
  onToggleFlag: () => void
}) {
  const scheme = useColorScheme() ?? 'light'
  return (
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
  )
}

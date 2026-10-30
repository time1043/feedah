import { Ionicons } from '@expo/vector-icons'
import { Pressable, Text, View, useColorScheme } from 'react-native'

import { meaningLines } from '@/lib/meaning'

/** Position number, the big tappable word (replays pronunciation) and ipa. */
export function CardHeadword({
  position,
  text,
  ipa,
  onReplay,
}: {
  position: number
  text: string
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

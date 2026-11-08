import type { ComponentProps } from 'react'

import { Ionicons } from '@expo/vector-icons'
import { Pressable, Text, View, useColorScheme } from 'react-native'

const MUTED = { light: '#9A9EA6', dark: '#7A7E86' } as const

/** Icon button for screen headers: one size (22 in a 36px hit box) and one
 * muted color everywhere, so icons never jitter between pages. */
export function HeaderIconButton({
  name,
  onPress,
  accessibilityLabel,
}: {
  name: ComponentProps<typeof Ionicons>['name']
  onPress: () => void
  accessibilityLabel: string
}) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  return (
    <Pressable
      className="h-9 w-9 items-center justify-center"
      onPress={onPress}
      hitSlop={4}
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons name={name} size={22} color={MUTED[scheme]} />
    </Pressable>
  )
}

type ScreenHeaderProps = {
  /** The centered title; omit it for an empty center (the row keeps its
   * height either way). */
  title?: string
  onBack: () => void
  onSearch: () => void
}

/**
 * The header row of the full-screen mode pages: back on the left, the title
 * centered (passed in by the screen), search on the right.
 */
export function ScreenHeader({ title, onBack, onSearch }: ScreenHeaderProps) {
  return (
    <View className="min-h-11 px-4 py-1 flex-row items-center">
      <HeaderIconButton name="chevron-back" onPress={onBack} accessibilityLabel="Back" />
      {title ? (
        <Text
          numberOfLines={1}
          className="font-semibold text-gray-500 dark:text-gray-400 flex-1 text-center text-[13px]"
        >
          {title}
        </Text>
      ) : (
        <View className="flex-1" />
      )}
      <HeaderIconButton name="search" onPress={onSearch} accessibilityLabel="Search words" />
    </View>
  )
}

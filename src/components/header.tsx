import type { ComponentProps, ReactNode } from 'react'

import { Ionicons } from '@expo/vector-icons'
import { Pressable, Text, View, useColorScheme } from 'react-native'

export const MUTED = { light: '#9A9EA6', dark: '#7A7E86' } as const

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

/** Header row of the four tabs: 22px bold title left, optional right slot.
 * The title is optional — an untitled tab renders its `left` slot when given
 * (the home header's leaf-and-wordmark brand row) or a spacer, so the right
 * slot still lands on the right edge. */
export function TabHeader({
  title,
  left,
  right,
}: {
  title?: string
  left?: ReactNode
  right?: ReactNode
}) {
  return (
    <View className="px-4 pb-2 pt-3 flex-row items-center justify-between">
      {title !== undefined ? (
        <Text className="font-bold text-black dark:text-white text-[22px]">{title}</Text>
      ) : left ? (
        left
      ) : (
        <View className="flex-1" />
      )}
      {right}
    </View>
  )
}

/**
 * The header row of the list pages (word list, round list): back on the
 * left, the title centered, and a free right slot — the caller decides what
 * lives there (the word list's eye toggle, …). Kept separate from
 * ScreenHeader so neither accumulates the other's judgments.
 */
export function ListHeader({
  title,
  onBack,
  right,
}: {
  title?: string
  onBack: () => void
  right?: ReactNode
}) {
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
      <View className="h-9 w-9 items-center justify-center">{right}</View>
    </View>
  )
}

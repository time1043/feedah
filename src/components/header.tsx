import type { ComponentProps, ReactNode } from 'react'

import { Ionicons } from '@expo/vector-icons'
import { Pressable, Text, View, useColorScheme } from 'react-native'

const MUTED = { light: '#9A9EA6', dark: '#7A7E86' } as const

/** Icon button for tab and screen headers: one size (22 in a 36px hit box)
 * and one muted color everywhere, so icons never jitter between pages. */
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

/** Header row of the four tabs: 22px bold title left, optional right slot
 * (icon callers wrap themselves in HeaderIconButton's 36px box; text slots
 * render unconstrained). The title is optional — the home header carries
 * only its search icon. */
export function TabHeader({ title, right }: { title?: string; right?: ReactNode }) {
  return (
    <View className="px-4 pb-2 pt-3 flex-row items-center justify-between">
      {title !== undefined && (
        <Text className="font-bold text-black dark:text-white text-[22px]">{title}</Text>
      )}
      {right}
    </View>
  )
}

/** Header row of pushed sub-pages: back on the left, centered title, right
 * slot. The back icon matches every other header icon. */
export function ScreenHeader({
  title,
  onBack,
  right,
}: {
  title: string
  onBack: () => void
  right?: ReactNode
}) {
  return (
    <View className="min-h-11 px-4 py-2 flex-row items-center">
      <HeaderIconButton name="chevron-back" onPress={onBack} accessibilityLabel="Back" />
      <Text className="font-semibold text-black dark:text-white flex-1 text-center text-[17px]">
        {title}
      </Text>
      <View className="h-9 w-9 items-center justify-center">{right}</View>
    </View>
  )
}

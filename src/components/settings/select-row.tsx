import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { Modal, Pressable, Text, View, useColorScheme } from 'react-native'

import { MUTED } from '@/components/header'

const BLUE = '#208AEF'

export type SelectOption = {
  value: string
  label: string
}

type SelectRowProps = {
  label: string
  /** The currently selected option's value. */
  value: string
  options: SelectOption[]
  onValueChange: (value: string) => void
}

/**
 * One labeled select row in a settings group: the label on the left, the
 * current value behind a chevron on the right, and the options in a modal
 * dropdown. The modal pattern keeps the settings page free of expanding
 * layout shifts; the backdrop tap closes it.
 */
export function SelectRow({ label, value, options, onValueChange }: SelectRowProps) {
  const [open, setOpen] = useState(false)
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  const current = options.find((option) => option.value === value)?.label ?? value

  return (
    <View>
      <Pressable
        className="py-2 flex-row items-center justify-between"
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${current}`}
        onPress={() => setOpen(true)}
      >
        <Text className="text-black dark:text-white">{label}</Text>
        <View className="gap-1.5 flex-row items-center">
          <Text className="text-gray-500 dark:text-gray-400">{current}</Text>
          <Ionicons name="chevron-down" size={16} color={MUTED[scheme]} />
        </View>
      </Pressable>

      <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
        {/* The backdrop closes; the option card stops the tap before it. */}
        <Pressable
          className="bg-black/40 p-6 flex-1 items-center justify-center"
          onPress={() => setOpen(false)}
        >
          <Pressable
            className="rounded-2xl bg-white p-2 dark:bg-gray-900 w-full"
            accessibilityLabel={`${label} options`}
            onPress={() => {}}
          >
            {options.map((option) => {
              const selected = option.value === value
              return (
                <Pressable
                  key={option.value}
                  className="rounded-xl px-3 py-3 flex-row items-center justify-between"
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={option.label}
                  onPress={() => {
                    onValueChange(option.value)
                    setOpen(false)
                  }}
                >
                  <Text
                    className={
                      selected
                        ? 'font-semibold text-blue-500 text-[15px]'
                        : 'text-black dark:text-white text-[15px]'
                    }
                  >
                    {option.label}
                  </Text>
                  {selected && <Ionicons name="checkmark" size={18} color={BLUE} />}
                </Pressable>
              )
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

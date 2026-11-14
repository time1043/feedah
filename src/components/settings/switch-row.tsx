import { Switch, Text, View, useColorScheme } from 'react-native'

import { ACCENT } from '@/lib/color'

type SwitchRowProps = {
  label: string
  value: boolean
  onValueChange: (value: boolean) => void
}

/** One labeled toggle row, the boolean sibling of the speech-rate row. */
export function SwitchRow({ label, value, onValueChange }: SwitchRowProps) {
  const dark = useColorScheme() === 'dark'

  return (
    <View className="py-1 flex-row items-center justify-between">
      <Text className="text-black dark:text-white">{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{
          false: dark ? '#374151' : '#D1D5DB',
          true: dark ? ACCENT.dark : ACCENT.light,
        }}
        // Android takes the thumb from the platform's blue unless it is
        // told; white is the knob both platforms agree on.
        thumbColor="#FFFFFF"
        accessibilityLabel={label}
      />
    </View>
  )
}

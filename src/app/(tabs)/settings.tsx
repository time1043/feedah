import { useAtom } from 'jotai'
import { Switch, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { hudPageAtom, hudRoundAtom, wordsMeaningAtom } from '@/atoms/settings'

/** Quiet footers on the deck screens: page number (right), round/time (left). */
export default function SettingsScreen() {
  const [showPage, setShowPage] = useAtom(hudPageAtom)
  const [showRound, setShowRound] = useAtom(hudRoundAtom)
  const [showMeaning, setShowMeaning] = useAtom(wordsMeaningAtom)

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      <Text className="p-4 pb-2 font-bold text-black dark:text-white text-[22px]">Settings</Text>
      <View className="gap-1 px-4">
        <SettingRow
          label="Page number"
          hint="Current position of the deck, bottom right"
          value={showPage}
          onChange={setShowPage}
        />
        <SettingRow
          label="Round / time"
          hint="Current feed round or review pass, bottom left"
          value={showRound}
          onChange={setShowRound}
        />
        <SettingRow
          label="Word meanings"
          hint="Show the meaning column in the word list"
          value={showMeaning}
          onChange={setShowMeaning}
        />
      </View>
    </SafeAreaView>
  )
}

function SettingRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <View className="border-gray-200 py-3 dark:border-gray-800 flex-row items-center justify-between border-b">
      <View className="pr-4 flex-1">
        <Text className="font-semibold text-black dark:text-white text-[15px]">{label}</Text>
        <Text className="mt-0.5 text-gray-500 dark:text-gray-400 text-[13px]">{hint}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} />
    </View>
  )
}

import type { ReactNode } from 'react'

import { useAtom } from 'jotai'
import { ScrollView, Switch, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  deckProgressBarAtom,
  deckTitleAtom,
  hudPageAtom,
  hudRoundAtom,
  searchLocalAtom,
  wordsMeaningAtom,
} from '@/atoms/settings'
import { TabHeader } from '@/components/header'
import ThemeToggle from '@/components/theme-toggle'

/** Global preferences: theme, study deck chrome, word list display, search. */
export default function SettingsScreen() {
  const [showTitle, setShowTitle] = useAtom(deckTitleAtom)
  const [showProgressBar, setShowProgressBar] = useAtom(deckProgressBarAtom)
  const [showPage, setShowPage] = useAtom(hudPageAtom)
  const [showRound, setShowRound] = useAtom(hudRoundAtom)
  const [showMeaning, setShowMeaning] = useAtom(wordsMeaningAtom)
  const [localSearch, setLocalSearch] = useAtom(searchLocalAtom)

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      <TabHeader title="Settings" />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="gap-1 px-4">
          <SettingRow
            label="Theme"
            hint="System, light or dark"
            value={undefined}
            onChange={undefined}
            children={<ThemeToggle />}
          />
          <SettingRow
            label="Deck title"
            hint="Mode and bucket label at the top of the study screen"
            value={showTitle}
            onChange={setShowTitle}
          />
          <SettingRow
            label="Progress bar"
            hint="The bar at the top of the study screen"
            value={showProgressBar}
            onChange={setShowProgressBar}
          />
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
          <SettingRow
            label="Local search"
            hint="Search opened from a bucket stays inside it"
            value={localSearch}
            onChange={setLocalSearch}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function SettingRow({
  label,
  hint,
  value,
  onChange,
  children,
}: {
  label: string
  hint: string
  value?: boolean
  onChange?: (value: boolean) => void
  children?: ReactNode
}) {
  return (
    <View className="border-gray-200 py-3 dark:border-gray-800 flex-row items-center justify-between border-b">
      <View className="pr-4 flex-1">
        <Text className="font-semibold text-black dark:text-white text-[15px]">{label}</Text>
        {hint && (
          <Text className="mt-0.5 text-gray-500 dark:text-gray-400 text-[13px]">{hint}</Text>
        )}
        {children && <View className="mt-3">{children}</View>}
      </View>
      {value !== undefined && onChange && <Switch value={value} onValueChange={onChange} />}
    </View>
  )
}

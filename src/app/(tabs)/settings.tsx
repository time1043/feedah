import { File, Paths } from 'expo-file-system'
import { router, useFocusEffect } from 'expo-router'
import * as Sharing from 'expo-sharing'
import { useAtom } from 'jotai'
import { useCallback, useState } from 'react'
import { Pressable, ScrollView, Switch, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  deckProgressBarAtom,
  deckTitleAtom,
  hudPageAtom,
  hudRoundAtom,
  searchLocalAtom,
  wordsMeaningAtom,
} from '@/atoms/settings'
import ThemeToggle from '@/components/theme-toggle'
import { buildStudyExport } from '@/db/export'
import { listBuckets } from '@/db/repo'
import { todayLocalDate } from '@/lib/date'

/** Global preferences: theme, study deck chrome, word list display, search,
 * and study-data export. */
export default function SettingsScreen() {
  const [showTitle, setShowTitle] = useAtom(deckTitleAtom)
  const [showProgressBar, setShowProgressBar] = useAtom(deckProgressBarAtom)
  const [showPage, setShowPage] = useAtom(hudPageAtom)
  const [showRound, setShowRound] = useAtom(hudRoundAtom)
  const [showMeaning, setShowMeaning] = useAtom(wordsMeaningAtom)
  const [localSearch, setLocalSearch] = useAtom(searchLocalAtom)
  const [exporting, setExporting] = useState(false)
  const [hasBuckets, setHasBuckets] = useState(false)

  useFocusEffect(
    useCallback(() => {
      void listBuckets().then((rows) => setHasBuckets(rows.length > 0))
    }, []),
  )

  const exportData = async () => {
    setExporting(true)
    try {
      const data = await buildStudyExport()
      const json = JSON.stringify(data, null, 2)
      const filename = `feedah-study-export-${todayLocalDate()}.json`
      const file = new File(Paths.cache, filename)
      file.write(json)
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <Text className="p-4 pb-2 font-bold text-black dark:text-white text-[22px]">Settings</Text>
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
          {hasBuckets && (
            <Pressable
              className="border-gray-200 py-3 dark:border-gray-800 flex-row items-center justify-between border-b"
              onPress={() => void exportData()}
              disabled={exporting}
            >
              <View className="pr-4 flex-1">
                <Text className="font-semibold text-black dark:text-white text-[15px]">
                  Export study data
                </Text>
                <Text className="mt-0.5 text-gray-500 dark:text-gray-400 text-[13px]">
                  Share your study progress as a JSON file
                </Text>
              </View>
              {exporting && <Text className="text-gray-400 dark:text-gray-500 text-[13px]">…</Text>}
            </Pressable>
          )}
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
  children?: React.ReactNode
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

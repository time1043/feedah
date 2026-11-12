import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { useAtom } from 'jotai'
import { Alert, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { deckHeaderAtom, deckProgressBarAtom, deckTitleAtom, deckFooterAtom } from '@/atoms/deck'
import { autoSpeakAtom, searchLocalAtom, tapToRevealAtom } from '@/atoms/settings'
import { wordsMeaningAtom } from '@/atoms/words'
import { TabHeader } from '@/components/header'
import { SpeechRateControl } from '@/components/settings/speech-rate-control'
import { SwitchRow } from '@/components/settings/switch-row'
import { ThemeToggle } from '@/components/settings/theme-toggle'
import { buildStudyExport } from '@/db/export'
import { todayLocalDate } from '@/lib/date'

/** Writes the study-state archive into the cache and opens the share
 * sheet. Word content is excluded: bundled buckets re-seed, imported ones
 * re-import — the archive carries the progress, flags, sessions and
 * statistics. */
const exportStudyData = async () => {
  try {
    const json = JSON.stringify(await buildStudyExport())
    const file = new File(Paths.cache, `feedah-study-export-${todayLocalDate()}.json`)
    file.write(json)
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json' })
  } catch (error) {
    Alert.alert('Export failed', error instanceof Error ? error.message : String(error))
  }
}

/** The settings tab: the rows grouped into cards, in the stats tab's card
 * style — tab header on top, full-width scroll, one bordered card per
 * group. */
export default function SettingsScreen() {
  const [autoSpeak, setAutoSpeak] = useAtom(autoSpeakAtom)
  const [tapToReveal, setTapToReveal] = useAtom(tapToRevealAtom)
  const [showHeader, setShowHeader] = useAtom(deckHeaderAtom)
  const [showTitle, setShowTitle] = useAtom(deckTitleAtom)
  const [showProgressBar, setShowProgressBar] = useAtom(deckProgressBarAtom)
  const [showFooter, setShowFooter] = useAtom(deckFooterAtom)
  const [wordsMeaning, setWordsMeaning] = useAtom(wordsMeaningAtom)
  const [localSearch, setLocalSearch] = useAtom(searchLocalAtom)

  return (
    <SafeAreaView className="bg-white dark:bg-black flex-1" edges={['bottom']}>
      <TabHeader title="Settings" />
      <ScrollView
        contentContainerStyle={{ gap: 24, padding: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Speech */}
        <View className="gap-3 rounded-xl border-gray-300 p-3 dark:border-gray-700 border">
          <SpeechRateControl />
        </View>

        {/* Study deck */}
        <View className="gap-3 rounded-xl border-gray-300 p-3 dark:border-gray-700 border">
          <Text className="font-semibold text-black dark:text-white text-[15px]">Study deck</Text>
          <View className="gap-1">
            <SwitchRow label="Auto speak" value={autoSpeak} onValueChange={setAutoSpeak} />
            <SwitchRow label="Tap to reveal" value={tapToReveal} onValueChange={setTapToReveal} />
            <SwitchRow label="Header" value={showHeader} onValueChange={setShowHeader} />
            <SwitchRow label="Header title" value={showTitle} onValueChange={setShowTitle} />
            <SwitchRow
              label="Progress bar"
              value={showProgressBar}
              onValueChange={setShowProgressBar}
            />
            <SwitchRow label="Page footer" value={showFooter} onValueChange={setShowFooter} />
          </View>
        </View>

        {/* Words & search */}
        <View className="gap-3 rounded-xl border-gray-300 p-3 dark:border-gray-700 border">
          <Text className="font-semibold text-black dark:text-white text-[15px]">
            Words & search
          </Text>
          <View className="gap-1">
            <SwitchRow
              label="Word list meanings"
              value={wordsMeaning}
              onValueChange={setWordsMeaning}
            />
            <SwitchRow
              label="Search stays in the opened bucket"
              value={localSearch}
              onValueChange={setLocalSearch}
            />
          </View>
        </View>

        {/* Theme */}
        <View className="gap-3 rounded-xl border-gray-300 p-3 dark:border-gray-700 border">
          <Text className="font-semibold text-black dark:text-white text-[15px]">Theme</Text>
          <ThemeToggle />
        </View>

        {/* Export */}
        <Pressable
          className="rounded-xl border-gray-300 p-3 dark:border-gray-700 items-center border"
          onPress={() => void exportStudyData()}
          accessibilityRole="button"
          accessibilityLabel="Export study data"
        >
          <Text className="text-black dark:text-white">Export study data</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

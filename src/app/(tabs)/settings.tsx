import { useAtom } from 'jotai'
import { Text, View } from 'react-native'

import { deckHeaderAtom, deckProgressBarAtom, deckTitleAtom, deckFooterAtom } from '@/atoms/deck'
import { autoSpeakAtom, searchLocalAtom, tapToRevealAtom } from '@/atoms/settings'
import { wordsMeaningAtom } from '@/atoms/words'
import { SpeechRateControl } from '@/components/settings/speech-rate-control'
import { SwitchRow } from '@/components/settings/switch-row'
import { ThemeToggle } from '@/components/settings/theme-toggle'

/** The settings tab: one row group per setting. */
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
    <View className="bg-white dark:bg-black flex-1 items-center justify-center">
      <Text className="text-xl font-bold text-blue-500">Settings</Text>

      <View className="mt-8 w-72 gap-6">
        <SpeechRateControl />

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

      <ThemeToggle />
    </View>
  )
}

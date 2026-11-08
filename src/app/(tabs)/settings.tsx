import { useAtom } from 'jotai'
import { Text, View } from 'react-native'

import { deckHeaderAtom, deckProgressBarAtom, deckTitleAtom, deckFooterAtom } from '@/atoms/deck'
import { autoSpeakAtom, tapToRevealAtom } from '@/atoms/settings'
import { SpeechRateControl } from '@/components/settings/speech-rate-control'
import { SwitchRow } from '@/components/settings/switch-row'
import ThemeToggle from '@/components/settings/theme-toggle'

/** The settings tab: one row group per setting. */
export default function SettingsScreen() {
  const [autoSpeak, setAutoSpeak] = useAtom(autoSpeakAtom)
  const [tapToReveal, setTapToReveal] = useAtom(tapToRevealAtom)
  const [showHeader, setShowHeader] = useAtom(deckHeaderAtom)
  const [showTitle, setShowTitle] = useAtom(deckTitleAtom)
  const [showProgressBar, setShowProgressBar] = useAtom(deckProgressBarAtom)
  const [showFooter, setShowFooter] = useAtom(deckFooterAtom)

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
      </View>

      <ThemeToggle />
    </View>
  )
}

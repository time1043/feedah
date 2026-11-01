import { useState } from 'react'
import { Pressable, View } from 'react-native'

import { BookmarkButton, CardForms, CardHeadword, CardMeaning } from '@/components/study/card-parts'

type WordCardProps = {
  position: number
  text: string
  meaning: string
  forms: string[]
  ipa?: string
  flagged: boolean
  onReplay: () => void
  onToggleFlag: () => void
}

/**
 * The swipe-mode card, split into two independent halves so toggling the
 * meaning never shifts anything:
 *   - top: position number, the word, and a fixed-height slot for the meaning
 *   - bottom: supplementary word forms, shown together with the meaning
 * Tap the word to replay it; tap anywhere else to reveal/hide the meaning;
 * the bookmark flags the word as unfamiliar.
 */
export function WordCard({
  position,
  text,
  meaning,
  forms,
  ipa,
  flagged,
  onReplay,
  onToggleFlag,
}: WordCardProps) {
  const [revealed, setRevealed] = useState(false)

  return (
    <View className="flex-1">
      <Pressable
        className="px-8 flex-1 items-center justify-center"
        onPress={() => setRevealed((value) => !value)}
      >
        <CardHeadword position={position} text={text} ipa={ipa} onReplay={onReplay} />
        {/* Reserved slot: keeps number and word anchored while meaning toggles. */}
        <View className="mt-4 h-[110px] items-center justify-start">
          {revealed && <CardMeaning meaning={meaning} />}
        </View>
      </Pressable>

      <Pressable
        className="px-8 flex-1 items-center justify-center"
        onPress={() => setRevealed((value) => !value)}
      >
        {revealed && <CardForms forms={forms} />}
      </Pressable>

      <BookmarkButton flagged={flagged} onToggleFlag={onToggleFlag} />
    </View>
  )
}

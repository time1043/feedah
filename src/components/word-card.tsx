import { useState } from 'react'
import { Pressable, View } from 'react-native'

import type { Word } from '@/types/bucket'

import { BookmarkButton, CardForms, CardHeadword, CardMeaning } from './drill/card-parts'

type WordCardProps = {
  word: Word
  /** Whether the meaning waits for a tap; off = always visible. */
  tapToReveal?: boolean
  /** The word's current flag state; the bookmark reflects it. */
  flagged?: boolean
  /** Tapping the bookmark toggles the flag; omit it to hide the bookmark. */
  onToggleFlag?: () => void
  /** Tapping the word or the ipa replays the pronunciation. */
  onReplay: () => void
}

/**
 * The full-screen word card, split into two fixed halves — the project's
 * layout convention, so nothing jitters as content changes:
 *   - top 50%: position, the word, the ipa, and a fixed-height slot for the
 *     meaning. The headword stays anchored whether the meaning is hidden or
 *     runs three lines.
 *   - bottom 50%: the supplementary word forms, in the fixed grid, shown
 *     together with the meaning.
 * With tap-to-reveal on, tapping anywhere on the card reveals or hides the
 * meaning and the forms — recall first, then check; with it off, both show
 * from the start and taps do nothing. The word and the ipa are their own
 * taps and replay the pronunciation instead.
 *
 * With a toggle callback the bookmark rides the card's bottom edge; the deck
 * hides it whenever the screen passes none.
 *
 * The card is assembled from the drill card kit (card-parts) — the same
 * pieces every drill card is built from, so the feed layout survives the
 * mode switch pixel for pixel.
 */
export function WordCard({
  word,
  tapToReveal = true,
  flagged = false,
  onToggleFlag,
  onReplay,
}: WordCardProps) {
  const [revealed, setRevealed] = useState(false)

  const shown = tapToReveal ? revealed : true
  const toggle = () => {
    if (tapToReveal) setRevealed((value) => !value)
  }

  return (
    <View className="flex-1">
      <Pressable className="px-8 flex-1 items-center justify-center" onPress={toggle}>
        <CardHeadword
          position={word.position}
          text={word.word}
          ipa={word.ipa}
          onReplay={onReplay}
        />

        {/* Reserved slot: keeps number and word anchored while the meaning
            toggles or wraps. */}
        <View className="mt-4 h-[110px] items-center justify-start">
          {shown && <CardMeaning meaning={word.meaning} />}
        </View>
      </Pressable>

      <Pressable className="px-8 flex-1 items-center justify-center" onPress={toggle}>
        {shown && <CardForms forms={word.forms} />}
      </Pressable>

      {onToggleFlag && <BookmarkButton flagged={flagged} onToggleFlag={onToggleFlag} />}
    </View>
  )
}

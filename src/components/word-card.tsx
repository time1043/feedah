import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import type { Word } from '@/types/bucket'

import { meaningLines } from '@/lib/meaning'

// Word forms render in a fixed 2×6 grid (12 cells); empty cells keep the
// layout, so the forms block is the same size on every card and never shifts.
const FORMS_GRID_CELLS = 12

/** The meaning, one line per part-of-speech group when it is long. */
function CardMeaning({ meaning }: { meaning: string }) {
  if (meaning.length === 0) return null
  const lines = meaningLines(meaning)
  return lines ? (
    <View className="gap-2 items-center">
      {lines.map((line, i) => (
        <Text key={i} className="text-xl text-gray-500 dark:text-gray-400 text-center">
          {line}
        </Text>
      ))}
    </View>
  ) : (
    <Text className="text-xl text-gray-500 dark:text-gray-400 text-center">{meaning}</Text>
  )
}

type WordCardProps = {
  word: Word
  /** Whether the meaning waits for a tap; off = always visible. */
  tapToReveal?: boolean
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
 */
export function WordCard({ word, tapToReveal = true, onReplay }: WordCardProps) {
  const [revealed, setRevealed] = useState(false)

  const shown = tapToReveal ? revealed : true
  const toggle = () => {
    if (tapToReveal) setRevealed((value) => !value)
  }

  return (
    <View className="flex-1">
      <Pressable className="px-8 flex-1 items-center justify-center" onPress={toggle}>
        <Text
          className="mb-4 font-semibold text-gray-500 dark:text-gray-400 text-[28px]"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {word.position}
        </Text>

        <Pressable onPress={onReplay} hitSlop={12}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
            className="font-extrabold text-black dark:text-white text-center text-[48px]"
          >
            {word.word}
          </Text>
        </Pressable>

        {word.ipa.length > 0 && (
          <Pressable onPress={onReplay} hitSlop={12}>
            <Text className="mt-2 text-lg text-gray-400 dark:text-gray-500 text-center">
              {word.ipa}
            </Text>
          </Pressable>
        )}

        {/* Reserved slot: keeps number and word anchored while the meaning
            toggles or wraps. */}
        <View className="mt-4 h-[110px] items-center justify-start">
          {shown && <CardMeaning meaning={word.meaning} />}
        </View>
      </Pressable>

      <Pressable className="px-8 flex-1 items-center justify-center" onPress={toggle}>
        {shown && word.forms.length > 0 && (
          <View className="mb-6 w-full flex-row flex-wrap">
            {Array.from({ length: FORMS_GRID_CELLS }).map((_, i) => (
              <View key={i} className="mb-2 h-7 px-2 w-1/2 justify-center">
                {word.forms[i] != null && (
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    className="text-gray-400 dark:text-gray-500 text-[13px]"
                  >
                    {word.forms[i]}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
      </Pressable>
    </View>
  )
}

import { Keyboard, Text, TextInput, View } from 'react-native'

import type { AnswerState } from '@/study/types'
import type { DeckWord } from '@/types/word'

import { BookmarkButton, CardForms, CardHeadword, CardMeaning } from '@/components/study/card-parts'
import { normalizeAnswer } from '@/lib/quiz'

type TypingCardProps = {
  word: DeckWord
  answered?: AnswerState
  /** Lifted to the screen: FlatList recycling wipes local input state. */
  draft?: string
  onDraft?: (value: string) => void
  onAnswer: (correct: boolean) => void
  onReplay: () => void
  onToggleFlag: () => void
}

/**
 * The typing card mirrors the feed card's layout exactly: the position sits
 * on top, the input line occupies the word's place, and the reserved meaning
 * slot below shows the Chinese prompt (always visible — it IS the prompt).
 * Enter submits the answer. Once submitted, the input line becomes the
 * verdict (green "✓ Correct", or red showing the attempt), while the
 * headword above reveals the right answer and the forms take their feed
 * positions.
 */
export function TypingCard({
  word,
  answered,
  draft = '',
  onDraft = () => {},
  onAnswer,
  onReplay,
  onToggleFlag,
}: TypingCardProps) {
  const submitted = typeof answered === 'object' && 'correct' in answered
  const revealed = answered !== undefined
  const correct = submitted && answered.correct
  const matches = normalizeAnswer(draft) === normalizeAnswer(word.word)

  const submit = () => {
    if (revealed || draft.trim().length === 0) return
    // Put the keyboard away so the feedback is visible.
    Keyboard.dismiss()
    onAnswer(matches)
  }

  // The underline scales with the word it stands for: one glyph per letter
  // plus padding, clamped so tiny and very long words both stay usable.
  const underlineWidth = Math.min(340, Math.max(140, 60 + word.word.length * 18))

  return (
    <View className="flex-1">
      <View className="px-8 flex-1 items-center justify-center">
        <CardHeadword
          position={word.position}
          text={revealed ? word.word : undefined}
          ipa={revealed ? word.ipa : undefined}
          onReplay={onReplay}
        />
        {!revealed && (
          <>
            <TextInput
              value={draft}
              onChangeText={onDraft}
              onSubmitEditing={submit}
              returnKeyType="go"
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              className="mt-4 border-gray-300 pb-2 text-black dark:border-gray-700 dark:text-white h-[64px] border-b-2 text-center text-[32px]"
              style={{ width: underlineWidth }}
            />
            {word.ipa && word.ipa.length > 0 && (
              <Text className="mt-2 text-lg text-gray-400 dark:text-gray-500 text-center">
                {word.ipa}
              </Text>
            )}
          </>
        )}
        {/* The verdict takes the input line's exact slot: green confirms, red
            marks the attempt — the right answer stands revealed above. */}
        {revealed && (
          <View
            className={`mt-4 rounded-xl px-4 h-[64px] items-center justify-center border-2 ${
              correct
                ? 'border-green-500 bg-green-50 dark:bg-green-950'
                : 'border-red-500 bg-red-50 dark:bg-red-950'
            }`}
            style={{ width: underlineWidth }}
          >
            <Text
              numberOfLines={1}
              className={`font-semibold text-center text-[20px] ${
                correct ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}
            >
              {correct ? '✓ Correct' : `✗ ${draft.trim()}`}
            </Text>
          </View>
        )}
        {/* Same reserved slot as the feed card: the Chinese prompt lives here. */}
        <View className="mt-4 h-[110px] items-center justify-start">
          <CardMeaning meaning={word.meaning} />
        </View>
      </View>

      <View className="px-8 flex-1 items-center justify-center">
        {revealed && <CardForms forms={word.forms} />}
      </View>

      <BookmarkButton flagged={word.flagged} onToggleFlag={onToggleFlag} />
    </View>
  )
}

import { Pressable, Text, TextInput, View } from 'react-native'

import type { AnswerState } from '@/study/types'
import type { DeckWord } from '@/types/word'

import { BookmarkButton, CardForms, CardHeadword, CardMeaning } from '@/components/study/card-parts'
import { normalizeAnswer } from '@/lib/quiz'

type TypingCardProps = {
  word: DeckWord
  answered: AnswerState
  /** Lifted to the screen: FlatList recycling wipes local input state. */
  draft?: string
  onDraft?: (value: string) => void
  onAnswer: (correct: boolean) => void
  onSkip: () => void
  onReplay: () => void
  onToggleFlag: () => void
}

/**
 * The typing card mirrors the feed card's layout exactly: the position sits
 * on top, the input line occupies the word's place, and the reserved meaning
 * slot below shows the Chinese prompt (always visible — it IS the prompt).
 * Once answered or revealed, the word and its forms appear in their feed
 * positions, so the revealed card is the feed card.
 */
export function TypingCard({
  word,
  answered,
  draft = '',
  onDraft = () => {},
  onAnswer,
  onSkip,
  onReplay,
  onToggleFlag,
}: TypingCardProps) {
  const submitted = typeof answered === 'object' && 'correct' in answered
  const revealed = answered !== undefined
  const correct = submitted && answered.correct
  const matches = normalizeAnswer(draft) === normalizeAnswer(word.word)

  const submit = () => {
    if (revealed || draft.trim().length === 0) return
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
              <Pressable
                onPress={onReplay}
                hitSlop={8}
                className="mt-2"
                accessibilityLabel="Play word"
              >
                <Text className="text-lg text-gray-400 dark:text-gray-500 text-center">
                  {word.ipa}
                </Text>
              </Pressable>
            )}
          </>
        )}
        {/* Same reserved slot as the feed card: the Chinese prompt lives here. */}
        <View className="mt-4 h-[110px] items-center justify-start">
          <CardMeaning meaning={word.meaning} />
        </View>
      </View>

      <View className="px-8 flex-1 items-center justify-center">
        {!revealed ? (
          <Pressable
            onPress={submit}
            className="rounded-xl bg-blue-500 px-10 py-3"
            accessibilityLabel="Submit answer"
          >
            <Text className="font-semibold text-white">Check</Text>
          </Pressable>
        ) : (
          <CardForms forms={word.forms} />
        )}
      </View>

      {!revealed && (
        <Pressable
          className="right-6 top-4 absolute"
          onPress={onSkip}
          hitSlop={8}
          accessibilityLabel="Show answer"
        >
          <Text className="text-gray-400 dark:text-gray-500 text-[13px]">show answer</Text>
        </Pressable>
      )}

      <BookmarkButton flagged={word.flagged} onToggleFlag={onToggleFlag} />
    </View>
  )
}

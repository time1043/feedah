import { Pressable, Text, TextInput, View } from 'react-native'

import type { AnswerState } from '@/study/types'
import type { DeckWord } from '@/types/word'

import { BookmarkButton, CardHeadword } from '@/components/study/card-parts'
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
 * The typing card: the Chinese meaning is the prompt, the English word goes
 * on the line. The input sits in the card's upper half so the keyboard never
 * covers it. Submitting locks the card and reveals the word; "show answer"
 * reveals it without recording. The prompt's meaning stays visible either
 * way. Swipe to move on — same exposure semantics as every mode.
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

  return (
    <View className="flex-1">
      <View className="px-8 pt-10 flex-1 justify-center">
        <Text className="text-gray-400 dark:text-gray-500 text-center text-[13px]">
          {word.position} · type the word
        </Text>
        {/* The prompt is the meaning; the English word stays hidden until
            the card is answered or revealed. */}
        <Text className="mt-6 font-semibold leading-9 text-black dark:text-white text-center text-[26px]">
          {word.meaning}
        </Text>
        <TextInput
          value={draft}
          onChangeText={onDraft}
          onSubmitEditing={submit}
          editable={!revealed}
          returnKeyType="go"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          placeholder="type the word…"
          placeholderTextColor="#9CA3AF"
          className={`mt-6 rounded-xl bg-white px-4 py-3 text-black dark:bg-gray-900 dark:text-white border text-center text-[19px] ${
            !revealed
              ? 'border-gray-300 dark:border-gray-700'
              : correct
                ? 'border-green-500 bg-green-50 dark:bg-green-950'
                : 'border-red-500 bg-red-50 dark:bg-red-950'
          }`}
        />
        {revealed && (
          <View className="mt-6 gap-3 items-center">
            {submitted && !correct && (
              <Text className="text-red-600 dark:text-red-400 text-[15px]">correct spelling:</Text>
            )}
            <CardHeadword
              position={word.position}
              text={word.word}
              ipa={word.ipa}
              onReplay={onReplay}
            />
            {revealed && 'skipped' in answered && (
              <Text className="text-gray-400 dark:text-gray-500 text-[13px]">not recorded</Text>
            )}
          </View>
        )}
      </View>

      <View className="flex-1 items-center justify-center">
        {!revealed ? (
          <Pressable
            onPress={submit}
            className="rounded-xl bg-blue-500 px-10 py-3"
            accessibilityLabel="Submit answer"
          >
            <Text className="font-semibold text-white">Check</Text>
          </Pressable>
        ) : null}
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

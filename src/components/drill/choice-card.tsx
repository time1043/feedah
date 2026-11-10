import { Pressable, Text, View } from 'react-native'

import type { AnswerState } from '@/drills/contract'
import type { QuizOption } from '@/lib/quiz'
import type { DeckWord } from '@/types/bucket'

import { BookmarkButton, CardHeadword, CardMeaning } from './card-parts'

type ChoiceCardProps = {
  word: DeckWord
  options: QuizOption[]
  answered?: AnswerState
  onAnswer: (correct: boolean, picked?: string) => void
  onReplay: () => void
  onToggleFlag: () => void
}

/**
 * The multiple-choice card: the English word on top, four Chinese options
 * below. Tapping an option locks the card — the correct one turns green,
 * a wrong pick turns red — and answering unlocks swiping (the gate opens;
 * correct answers auto-advance on top of that). The round's flag list is
 * untouched by the answer itself.
 */
export function ChoiceCard({
  word,
  options,
  answered,
  onAnswer,
  onReplay,
  onToggleFlag,
}: ChoiceCardProps) {
  const picked = typeof answered === 'object' && 'picked' in answered ? answered.picked : undefined
  const locked = answered !== undefined

  return (
    <View className="flex-1">
      {/* Mirrors the swipe card's top half: same reserved meaning slot keeps
          the headword at the exact same position as the feed. */}
      <View className="px-8 flex-1 items-center justify-center">
        <CardHeadword
          position={word.position}
          text={word.word}
          ipa={word.ipa}
          onReplay={onReplay}
        />
        <View className="mt-4 h-[110px] items-center justify-start">
          {locked && <CardMeaning meaning={word.meaning} />}
        </View>
      </View>

      <View className="gap-2 px-8 pb-10 flex-1 justify-center">
        {options.map((option) => {
          const isPicked = picked === option.key
          const state = !locked
            ? 'idle'
            : option.isCorrect
              ? 'correct'
              : isPicked
                ? 'wrong'
                : 'muted'
          const classes = {
            idle: 'border-gray-300 dark:border-gray-700',
            correct: 'border-green-500 bg-green-50 dark:bg-green-950',
            wrong: 'border-red-500 bg-red-50 dark:bg-red-950',
            muted: 'border-gray-200 opacity-50 dark:border-gray-800',
          }[state]
          const textClass = {
            idle: 'text-black dark:text-white',
            correct: 'font-semibold text-green-700 dark:text-green-400',
            wrong: 'font-semibold text-red-600 dark:text-red-400',
            muted: 'text-gray-400 dark:text-gray-500',
          }[state]
          return (
            <Pressable
              key={option.key}
              disabled={locked}
              onPress={() => onAnswer(option.isCorrect, option.key)}
              className={`rounded-xl px-3 py-5 border ${classes}`}
            >
              <Text className={`text-left text-[14px] ${textClass}`}>{option.meaning}</Text>
            </Pressable>
          )
        })}
      </View>

      <BookmarkButton flagged={word.flagged} onToggleFlag={onToggleFlag} />
    </View>
  )
}

import type { QuizOption } from '@/lib/quiz'
import type { StudyMode } from '@/study/types'

import { ChoiceCard } from '@/components/study/choice-card'
import { TypingCard } from '@/components/study/typing-card'
import { WordCard } from '@/components/word-card'
import { buildOptions, pickDistractors } from '@/lib/quiz'

const swipeMode: StudyMode = {
  id: 'swipe',
  label: 'Feed',
  renderCard: (props) => (
    <WordCard
      position={props.word.position}
      text={props.word.word}
      meaning={props.word.meaning}
      forms={props.word.forms}
      ipa={props.word.ipa}
      flagged={props.word.flagged}
      onReplay={props.onReplay}
      onToggleFlag={props.onToggleFlag}
    />
  ),
  speakOnSettle: true,
  scrubbable: true,
  scrollable: true,
  endCopy: ({ nextRound }) => ({
    title: 'Round complete',
    subtitle: `Round ${nextRound} starts in a moment`,
  }),
}

const choiceMode: StudyMode = {
  id: 'choice',
  label: 'Quiz',
  // Options are computed once per load: curated distractors topped up from
  // the bucket, shuffled into display order. Fixed for the whole session —
  // recycled cards must not reshuffle in front of the user.
  prepare: (words) => {
    const payloads = new Map<number, unknown>()
    for (const word of words) {
      payloads.set(
        word.position,
        buildOptions(word, pickDistractors(word, word.distractors, words)),
      )
    }
    return payloads
  },
  renderCard: (props) => (
    <ChoiceCard
      word={props.word}
      options={(props.payload as QuizOption[] | undefined) ?? []}
      answered={props.answered}
      onAnswer={props.onAnswer}
      onNext={props.onNext}
      onReplay={props.onReplay}
      onToggleFlag={props.onToggleFlag}
    />
  ),
  // Speaking the English word is safe here — the options are Chinese.
  speakOnSettle: true,
  scrubbable: false,
  scrollable: false,
  autoAdvanceMs: 650,
  endCopy: ({ nextRound, correct, answered }) => ({
    title: 'Round complete',
    subtitle: `${correct} of ${answered} correct · Round ${nextRound} starts in a moment`,
  }),
}

const typingMode: StudyMode = {
  id: 'typing',
  label: 'Type',
  renderCard: (props) => (
    <TypingCard
      word={props.word}
      answered={props.answered}
      draft={props.draft}
      onDraft={props.onDraft}
      onAnswer={props.onAnswer}
      onNext={props.onNext}
      onSkip={props.onSkip}
      onReplay={props.onReplay}
      onToggleFlag={props.onToggleFlag}
    />
  ),
  // Speaking the word would leak the answer; scrubbing skips past typing.
  speakOnSettle: false,
  scrubbable: false,
  scrollable: false,
  autoAdvanceMs: 900,
  endCopy: ({ nextRound, correct, answered }) => ({
    title: 'Round complete',
    subtitle: `${correct} of ${answered} typed right · Round ${nextRound} starts in a moment`,
  }),
}

/**
 * The study modes. Registry entries are module-level constants: their
 * renderCard references stay stable across renders, which keeps the deck's
 * compiled subtree from invalidating on every settle.
 */
export const STUDY_MODES: StudyMode[] = [swipeMode, choiceMode, typingMode]

export function getStudyMode(id: string): StudyMode {
  return STUDY_MODES.find((mode) => mode.id === id) ?? swipeMode
}

import type { QuizOption } from '@/lib/quiz'

import { ChoiceCard } from '@/components/drill/choice-card'
import { buildOptions, pickDistractors } from '@/lib/quiz'

import type { Drill } from './contract'

// The quiz drill's per-card options, rebuilt by prepare() on every data
// load and read by renderCard. Keyed by bucket AND position: date-walk
// decks span buckets, where positions collide. Module-level on purpose:
// the data must stay stable across FlatList card recycling (and HMR
// simply restarts it).
const quizOptions = new Map<string, QuizOption[]>()

const choiceDrill: Drill = {
  id: 'quiz',
  label: 'Quiz',
  // Options are computed once per load: curated distractors topped up from
  // the bucket, shuffled into display order. Fixed for the whole session —
  // recycled cards must not reshuffle in front of the user.
  prepare: (words) => {
    quizOptions.clear()
    for (const word of words) {
      quizOptions.set(
        `${word.bucketName ?? ''}:${word.position}`,
        buildOptions(word, pickDistractors(word, word.distractors ?? [], words)),
      )
    }
  },
  renderCard: (props) => (
    <ChoiceCard
      word={props.word}
      options={quizOptions.get(`${props.word.bucketName ?? ''}:${props.word.position}`) ?? []}
      answered={props.answered}
      onAnswer={props.onAnswer}
      onReplay={props.onReplay}
      onToggleFlag={props.onToggleFlag}
    />
  ),
  // Speaking the English word is safe here — the options are Chinese.
  speakOnSettle: true,
  scrubbable: true,
  scrollable: false,
  autoAdvanceMs: 650,
  autoFlagOnWrong: true,
  endCopy: ({ nextRound, correct, answered }) => ({
    title: 'Round complete',
    stats: `${correct} of ${answered} correct`,
    note: `Round ${nextRound} starts in a moment`,
  }),
}

export default choiceDrill

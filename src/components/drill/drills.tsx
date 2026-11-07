import type { QuizOption } from '@/lib/quiz'
import type { Drill } from '@/types/drill'

import { ChoiceCard } from '@/components/drill/choice-card'
import { TypingCard } from '@/components/drill/typing-card'
import { WordCard } from '@/components/drill/word-card'
import { buildOptions, pickDistractors } from '@/lib/quiz'

// The quiz drill's per-card options, rebuilt by prepare() on every data
// load and read by renderCard. Keyed by bucket AND position: date-walk
// decks span buckets, where positions collide. Module-level on purpose:
// the data must stay stable across FlatList card recycling (and HMR
// simply restarts it).
const quizOptions = new Map<string, QuizOption[]>()

const swipeDrill: Drill = {
  id: 'swipe',
  label: 'Swipe',
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
    note: `Round ${nextRound} starts in a moment`,
  }),
}

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
        `${word.bucketId ?? ''}:${word.position}`,
        buildOptions(word, pickDistractors(word, word.distractors, words)),
      )
    }
  },
  renderCard: (props) => (
    <ChoiceCard
      word={props.word}
      options={quizOptions.get(`${props.word.bucketId ?? ''}:${props.word.position}`) ?? []}
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

const typingDrill: Drill = {
  id: 'type',
  label: 'Type',
  renderCard: (props) => (
    <TypingCard
      word={props.word}
      answered={props.answered}
      draft={props.draft}
      onDraft={props.onDraft}
      onAnswer={props.onAnswer}
      onReplay={props.onReplay}
      onToggleFlag={props.onToggleFlag}
    />
  ),
  // The TTS pronounces the word as a dictation cue — the user hears it and
  // types what they hear. The spelling stays hidden until they submit.
  speakOnSettle: true,
  scrubbable: true,
  scrollable: false,
  // Correct submits slide on by themselves; wrong ones stay put so the
  // revealed answer gets read before the next swipe.
  autoAdvanceMs: 900,
  // A misspelling is exactly what the flag list exists for: wrong submits
  // join the round's review queue, and the bookmark stays as the undo.
  autoFlagOnWrong: true,
  endCopy: ({ nextRound, correct, answered }) => ({
    title: 'Round complete',
    stats: `${correct} of ${answered} typed right`,
    note: `Round ${nextRound} starts in a moment`,
  }),
}

/**
 * The drills. Registry entries are module-level constants: their renderCard
 * references stay stable across renders, which keeps the deck's compiled
 * subtree from invalidating on every settle.
 */
export const DRILLS: Drill[] = [swipeDrill, choiceDrill, typingDrill]

export function getDrill(id: string): Drill {
  return DRILLS.find((drill) => drill.id === id) ?? swipeDrill
}

import { TypingCard } from '@/components/drill/typing-card'

import type { Drill } from './contract'

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

export default typingDrill

import { WordCard } from '@/components/word-card'

import type { Drill } from './contract'

/**
 * The quiz drill, in placeholder shape: registered and switchable, but the
 * card is still the plain feed card and the deck scrolls freely. The
 * multiple-choice card, the option data and the auto-flag/auto-advance
 * policy land with the drill's implementation.
 */
const choiceDrill: Drill = {
  id: 'quiz',
  label: 'Quiz',
  renderCard: (props) => (
    <WordCard
      word={props.word}
      tapToReveal={props.tapToReveal}
      flagged={props.word.flagged}
      onReplay={props.onReplay}
      onToggleFlag={props.onToggleFlag}
    />
  ),
  speakOnSettle: true,
  scrubbable: true,
  // Freely scrollable until the answer gate exists — a gate with nothing to
  // answer would dead-end the deck.
  scrollable: true,
  endCopy: ({ nextRound }) => ({
    title: 'Round complete',
    note: `Round ${nextRound} starts in a moment`,
  }),
}

export default choiceDrill

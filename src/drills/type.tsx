import { WordCard } from '@/components/word-card'

import type { Drill } from './contract'

/**
 * The type drill, in placeholder shape: registered and switchable, but the
 * card is still the plain feed card and the deck scrolls freely. The
 * dictation card, the grading and the auto-flag/auto-advance policy land
 * with the drill's implementation.
 */
const typingDrill: Drill = {
  id: 'type',
  label: 'Type',
  renderCard: (props) => (
    <WordCard
      word={props.word}
      tapToReveal={props.tapToReveal}
      flagged={props.word.flagged}
      onReplay={props.onReplay}
      onToggleFlag={props.onToggleFlag}
    />
  ),
  // The TTS will pronounce the word as the dictation cue once the typing
  // card lands — speech never leaks the spelling.
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

export default typingDrill

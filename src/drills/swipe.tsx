import { WordCard } from '@/components/word-card'

import type { Drill } from './contract'

/**
 * The swipe drill: no answering at all — the card IS the feed card, the
 * deck scrolls freely and nothing is recorded. This is also the registry's
 * fallback (getDrill on an unknown id).
 */
const swipeDrill: Drill = {
  id: 'swipe',
  label: 'Swipe',
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
  scrollable: true,
  endCopy: ({ nextRound }) => ({
    title: 'Round complete',
    note: `Round ${nextRound} starts in a moment`,
  }),
}

export default swipeDrill

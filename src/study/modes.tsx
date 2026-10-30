import type { StudyMode } from '@/study/types'

import { WordCard } from '@/components/word-card'

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
  endCopy: ({ nextRound }) => ({
    title: 'Round complete',
    subtitle: `Round ${nextRound} starts in a moment`,
  }),
}

/**
 * The study modes. Registry entries are module-level constants: their
 * renderCard references stay stable across renders, which keeps the deck's
 * compiled subtree from invalidating on every settle.
 */
export const STUDY_MODES: StudyMode[] = [swipeMode]

export function getStudyMode(id: string): StudyMode {
  return STUDY_MODES.find((mode) => mode.id === id) ?? swipeMode
}

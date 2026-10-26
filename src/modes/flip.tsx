import { WordCard } from '@/components/word-card';
import { speakWord } from '@/lib/speech';

import type { ModeCardProps, ModePlugin } from './types';

/**
 * The original interaction: tap toggles the meaning, and swiping past the
 * card is what records it (the feed's settle path). The card never calls
 * onResult — the container's landed-settle advance is the whole contract.
 */
function FlipCard({ item, bucket, settings, flagged, onToggleFlagged }: ModeCardProps) {
  return (
    <WordCard
      position={item.position}
      text={item.text}
      meaning={item.meaning}
      forms={item.forms}
      ipa={item.ipa}
      flagged={flagged}
      kind={bucket.kind}
      meaningMode={settings.meaningMode}
      onReplay={() => speakWord(item.text, settings.speechRate, bucket.language)}
      onToggleFlagged={onToggleFlagged}
    />
  );
}

export const flipMode: ModePlugin = {
  id: 'flip',
  displayName: 'Flip',
  description: 'Tap to reveal the answer; swipe to the next card',
  autoAdvanceMs: null,
  Card: FlipCard,
};

import type { ComponentType } from 'react';

import type { WordRow } from '@/db/repo';
import type { BucketKind } from '@/db/schema';
import type { Settings } from '@/db/settings';

/**
 * What a mode reports to the feed container. The closed union is additive:
 * future modes may add variants; the container ignores what it does not know.
 */
export type ModeResult = {
  kind: 'answered';
  correct: boolean;
  /** The option text the user picked ('' for modes without options). */
  chosen: string;
  elapsedMs: number;
};

export type ModeCardProps = {
  item: WordRow;
  bucket: { id: string; kind: BucketKind; language: string };
  /** The bucket's whole word list (the feed's own array, by reference). */
  pool: WordRow[];
  /** Current round — seeds deterministic option order across rounds. */
  round: number;
  settings: Settings;
  flagged: boolean;
  onResult: (result: ModeResult) => void;
  onToggleFlagged: () => void;
  /** Card-initiated advance to the next page (future "Next" buttons). */
  requestAdvance: () => void;
};

/**
 * A study-mode plugin. The feed owns the queue, paging, and the universal
 * recording path (advancePointer / round completion); the plugin owns the
 * card body, its feedback, and when it reports results. The feed auto-
 * advances after a reported result when autoAdvanceMs is set; a null value
 * keeps the swipe-only flow (the landed settle records the card, as before).
 */
export type ModePlugin = {
  id: string;
  /** Picker label on the buckets page. */
  displayName: string;
  /** Picker subtext on the buckets page. */
  description: string;
  /** Feedback linger before the feed auto-advances; null = swipe only. */
  autoAdvanceMs: number | null;
  /** Kinds this mode can present; absent = all kinds. */
  supports?: (kind: BucketKind) => boolean;
  Card: ComponentType<ModeCardProps>;
};

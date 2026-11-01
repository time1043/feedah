import type { StudyModeId } from '@/study/types'

import { storedAtom } from '@/atoms/storage'

/** The bucket the home screen studies and the decks open on. */
export const activeBucketAtom = storedAtom<string>('feedah.active-bucket', '2050')

/** Which study mode the Continue button opens. */
export const studyModeAtom = storedAtom<StudyModeId>('feedah.study-mode', 'swipe')

/** Whether the word list shows the meaning column (default hidden). */
export const wordsMeaningAtom = storedAtom<boolean>('feedah.words-meaning', false)

/** The study deck's header: mode/bucket title and the progress bar. */
export const deckTitleAtom = storedAtom<boolean>('feedah.deck-title', true)
export const deckProgressBarAtom = storedAtom<boolean>('feedah.deck-progress-bar', true)

/** The deck footers: current page number (bottom right) and round/time (bottom left). */
export const hudPageAtom = storedAtom<boolean>('feedah.hud-page', true)
export const hudRoundAtom = storedAtom<boolean>('feedah.hud-round', true)

/**
 * Global search scope: the bucket ids to search when no bucket is pinned.
 * An empty list means every bucket. The scope picker keeps it explicit once
 * the user touches it.
 */
export const searchScopeAtom = storedAtom<string[]>('feedah.search-scope', [])

/** Whether opening search from inside a bucket scopes it to that bucket. */
export const searchLocalAtom = storedAtom<boolean>('feedah.search-local', true)

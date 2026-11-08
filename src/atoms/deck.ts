import { storedAtom } from '@/atoms/storage'

/** Whether the mode screens' header shows at all (back + search stay with
 * it; hiding it hides the whole row). */
export const deckHeaderAtom = storedAtom<boolean>('feedah.deck-header', true)

/** Whether the header shows its title (the icons stay either way). */
export const deckTitleAtom = storedAtom<boolean>('feedah.deck-title', true)

/** Whether the deck's scrubbable progress bar shows. */
export const deckProgressBarAtom = storedAtom<boolean>('feedah.deck-progress-bar', true)

/** Whether the deck's page footer shows (bottom right, n/total). */
export const deckFooterAtom = storedAtom<boolean>('feedah.hud-page', true)

import { storedAtom } from '@/atoms/storage'

/** Whether the mode screens' header shows at all (back + search stay with
 * it; hiding it hides the whole row). */
export const deckHeaderAtom = storedAtom<boolean>('feedah.deck-header', true)

/** Whether the header shows its title (the icons stay either way). */
export const deckTitleAtom = storedAtom<boolean>('feedah.deck-title', true)

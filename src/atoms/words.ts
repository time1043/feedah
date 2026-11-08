import { storedAtom } from '@/atoms/storage'

/** Whether the word list shows the meaning column (default hidden). */
export const wordsMeaningAtom = storedAtom<boolean>('feedah.words-meaning', false)

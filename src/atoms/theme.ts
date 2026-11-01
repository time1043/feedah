import { storedAtom } from '@/atoms/storage'

export const themes = ['system', 'light', 'dark'] as const
export type Theme = (typeof themes)[number]

// Key predates the feedah.* convention; renaming would drop saved prefs.
export const currentThemeAtom = storedAtom<Theme>('theme', 'system')

import { storedAtom } from '@/atoms/storage'

export const themes = ['system', 'light', 'dark'] as const
export type Theme = (typeof themes)[number]

/** The theme preference; 'system' follows the OS. */
export const currentThemeAtom = storedAtom<Theme>('feedah.theme', 'system')

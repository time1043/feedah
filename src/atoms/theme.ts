import { atom } from 'jotai'

export const themes = ['system', 'light', 'dark'] as const
export type Theme = (typeof themes)[number]

export const currentThemeAtom = atom<Theme>('system')

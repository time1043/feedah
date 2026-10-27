import AsyncStorage from '@react-native-async-storage/async-storage'
import { atomWithStorage, createJSONStorage } from 'jotai/utils'

export const themes = ['system', 'light', 'dark'] as const
export type Theme = (typeof themes)[number]

const currentThemeStorage = createJSONStorage<Theme>(() => AsyncStorage)
export const currentThemeAtom = atomWithStorage<Theme>('theme', 'system', currentThemeStorage)

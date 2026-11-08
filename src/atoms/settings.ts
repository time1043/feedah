import AsyncStorage from '@react-native-async-storage/async-storage'
import { atom, getDefaultStore } from 'jotai'

import { storedAtom } from '@/atoms/storage'

/** The factory speech rate; what "restore default" resets to. 1.0 is the
 * system default, slightly accelerated for studying. */
export const DEFAULT_SPEECH_RATE = 1.15

const SPEECH_RATE_KEY = 'feedah.speech-rate'

/** The speech rate for word pronunciation. */
export const speechRateAtom = storedAtom<number>(SPEECH_RATE_KEY, DEFAULT_SPEECH_RATE)

/**
 * Flips once the speech-rate key has been read from AsyncStorage. The atom
 * starts at the factory rate and only settles on the stored one when the
 * storage read resolves — a first-frame speak racing ahead of that would
 * use the factory value, which is exactly the "first launch sounds right,
 * every replay after is slow" bug. Screens gate their auto-speak on this.
 */
export const speechRateReadyAtom = atom(false)

// The same key the atom hydrates from: re-apply the stored value ourselves,
// then open the gate — so by the time the gate is open, the atom's value IS
// the stored one. jotai's own hydration lands on the same value either way.
void (async () => {
  const store = getDefaultStore()
  try {
    const raw = await AsyncStorage.getItem(SPEECH_RATE_KEY)
    if (raw != null) store.set(speechRateAtom, JSON.parse(raw) as number)
  } catch {
    // Unreadable storage: the factory rate stands.
  } finally {
    store.set(speechRateReadyAtom, true)
  }
})()

/** Whether opening a card speaks the word. */
export const autoSpeakAtom = storedAtom<boolean>('feedah.auto-speak', true)

/** Whether the meaning waits for a tap; off = always visible on the card. */
export const tapToRevealAtom = storedAtom<boolean>('feedah.tap-to-reveal', true)

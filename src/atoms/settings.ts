import { storedAtom } from '@/atoms/storage'

/** The factory speech rate; what "restore default" resets to. 1.0 is the
 * system default, slightly accelerated for studying. */
export const DEFAULT_SPEECH_RATE = 1.15

/** The speech rate for word pronunciation. */
export const speechRateAtom = storedAtom<number>('feedah.speech-rate', DEFAULT_SPEECH_RATE)

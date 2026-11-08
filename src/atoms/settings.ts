import { storedAtom } from '@/atoms/storage'

/** The speech rate for word pronunciation; 1.0 is the system default. */
export const speechRateAtom = storedAtom<number>('feedah.speech-rate', 1.15)

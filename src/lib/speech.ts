import * as Speech from 'expo-speech'

/**
 * Speaks a single English word, interrupting any queued speech first. The
 * rate is injected by the caller — it is a user setting (speechRateAtom),
 * and the screen owns the speech policy.
 */
export function speakWord(text: string, rate: number): void {
  void Speech.stop()
  Speech.speak(text, { language: 'en-US', rate })
}

import * as Speech from 'expo-speech'

/** Rate multiplier for en-US speech; 1.0 is the system default. */
const SPEECH_RATE = 1.15

/** Speaks a single English word, interrupting any queued speech first. */
export function speakWord(text: string): void {
  void Speech.stop()
  Speech.speak(text, { language: 'en-US', rate: SPEECH_RATE })
}

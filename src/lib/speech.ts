import * as Speech from 'expo-speech';

import { SPEECH_RATE_VALUE, type SpeechRate } from '@/db/settings';

/** Speaks a single English word, interrupting any queued speech first. */
export function speakWord(text: string, rate: SpeechRate): void {
  void Speech.stop();
  Speech.speak(text, { language: 'en-US', rate: SPEECH_RATE_VALUE[rate] });
}

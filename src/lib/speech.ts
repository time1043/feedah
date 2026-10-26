import * as Speech from 'expo-speech';

import { SPEECH_RATE_VALUE, type SpeechRate } from '@/db/settings';

// Base language code -> speech tag. Anything unmapped passes through
// untouched, so an import carrying a full BCP47 tag ("pt-BR") keeps working.
const LOCALE_MAP: Record<string, string> = {
  en: 'en-US',
  zh: 'zh-CN',
  ja: 'ja-JP',
  ko: 'ko-KR',
  fr: 'fr-FR',
  de: 'de-DE',
  es: 'es-ES',
};

/**
 * Maps a bucket's target language to a speech locale. '' (import omitted the
 * tag) and unknown codes fall back to en-US so the bundled English buckets
 * never lose their voice.
 */
export function speechLocale(language?: string): string {
  if (!language) return 'en-US';
  return LOCALE_MAP[language.toLowerCase()] ?? language;
}

/** Speaks a single term, interrupting any queued speech first. */
export function speakWord(text: string, rate: SpeechRate, language?: string): void {
  void Speech.stop();
  Speech.speak(text, { language: speechLocale(language), rate: SPEECH_RATE_VALUE[rate] });
}

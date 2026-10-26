import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { buildQuizOptions } from '@/lib/distractors';
import { meaningLines } from '@/lib/meaning';
import { speakWord } from '@/lib/speech';
import { useTheme } from '@/theme/context';
import { fontSize, radius, spacing } from '@/theme/tokens';

import type { ModeCardProps, ModePlugin } from './types';

// Distractors per card; with the correct option the quiz shows up to four.
const OPTION_COUNT = 3;

/**
 * Multiple-choice card: the term on top, up to four options below (three
 * distractors sampled from the same bucket plus the answer, deterministic
 * per round+position). Tapping an option reports the answer immediately and
 * highlights it; the feed lingers on the feedback, shows the full back text,
 * then advances itself. The bookmark stays available; the word replays on tap.
 */
function ChoiceCard({
  item,
  bucket,
  pool,
  round,
  settings,
  flagged,
  onResult,
  onToggleFlagged,
}: ModeCardProps) {
  const { colors } = useTheme();
  // Stable per render (seeded), so re-renders never reshuffle options.
  const options = buildQuizOptions(item, pool, bucket.kind, OPTION_COUNT, round);
  const [chosen, setChosen] = useState<string | null>(null);
  const mountedAt = useRef(Date.now());

  const answered = chosen !== null;
  const pick = (text: string) => {
    if (chosen !== null) return;
    setChosen(text);
    onResult({
      kind: 'answered',
      correct: text === options.find((option) => option.correct)?.text,
      chosen: text,
      elapsedMs: Date.now() - mountedAt.current,
    });
  };

  const backLines = answered ? meaningLines(item.meaning, bucket.kind) : null;

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <Text style={[styles.position, { color: colors.textSecondary }]}>{item.position}</Text>
        <Pressable
          onPress={() => speakWord(item.text, settings.speechRate, bucket.language)}
          hitSlop={12}
        >
          <Text
            numberOfLines={bucket.kind === 'qa' ? 5 : 1}
            adjustsFontSizeToFit
            minimumFontScale={bucket.kind === 'qa' ? 0.6 : 0.5}
            style={[styles.term, { color: colors.text }]}
          >
            {item.text}
          </Text>
        </Pressable>
        {!answered && item.ipa.length > 0 && (
          <Text style={[styles.ipa, { color: colors.textTertiary }]}>{item.ipa}</Text>
        )}
      </View>

      <View style={styles.options}>
        {options.map((option) => {
          const isChosen = option.text === chosen;
          const showCorrect = answered && option.correct;
          const showWrong = answered && isChosen && !option.correct;
          return (
            <Pressable
              key={option.text}
              disabled={answered}
              onPress={() => pick(option.text)}
              style={[
                styles.option,
                { backgroundColor: colors.surface },
                showCorrect && { backgroundColor: colors.success },
                showWrong && { backgroundColor: colors.danger },
              ]}
            >
              <Text
                numberOfLines={3}
                style={[
                  styles.optionText,
                  { color: colors.textSecondary },
                  (showCorrect || showWrong) && { color: '#FFFFFF' },
                ]}
              >
                {option.text}
              </Text>
            </Pressable>
          );
        })}
        {answered && (
          <View style={styles.back}>
            {backLines ? (
              backLines.map((line, i) => (
                <Text key={i} style={[styles.backText, { color: colors.textTertiary }]}>
                  {line}
                </Text>
              ))
            ) : (
              <Text style={[styles.backText, { color: colors.textTertiary }]}>{item.meaning}</Text>
            )}
          </View>
        )}
      </View>

      <Pressable
        style={styles.flag}
        onPress={onToggleFlagged}
        hitSlop={16}
        accessibilityLabel={flagged ? 'Unflag word' : 'Flag word'}
      >
        <Ionicons
          name={flagged ? 'bookmark' : 'bookmark-outline'}
          size={26}
          color={flagged ? colors.danger : colors.textTertiary}
        />
      </Pressable>
    </View>
  );
}

export const choiceMode: ModePlugin = {
  id: 'choice',
  displayName: 'Quiz',
  description: 'Pick the right answer out of four options',
  autoAdvanceMs: 1600,
  Card: ChoiceCard,
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  top: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  position: {
    fontSize: 28,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    marginBottom: spacing.m,
  },
  term: {
    fontSize: fontSize.word,
    fontWeight: '800',
    textAlign: 'center',
  },
  ipa: {
    fontSize: 18,
    marginTop: spacing.s,
  },
  options: {
    flex: 1,
    gap: spacing.s,
    justifyContent: 'center',
    paddingHorizontal: spacing.l,
  },
  option: {
    borderRadius: radius.l,
    minHeight: 48,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    justifyContent: 'center',
  },
  optionText: {
    fontSize: fontSize.body,
    textAlign: 'center',
  },
  back: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingBottom: spacing.l,
  },
  backText: {
    fontSize: fontSize.caption,
    textAlign: 'center',
  },
  flag: {
    alignItems: 'center',
    bottom: spacing.xl,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
});

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { MeaningMode } from '@/db/settings';
import { useTheme } from '@/theme/context';
import { fontSize, spacing } from '@/theme/tokens';

// Word forms render in a fixed 2×6 grid (12 cells). The largest dataset entry
// has 11 forms (word "act"), so 12 cells always fit; empty cells keep the
// layout and card height constant across words.
const FORMS_COLUMNS = 2;
const FORMS_ROWS = 6;
const FORMS_GRID_CELLS = FORMS_COLUMNS * FORMS_ROWS;

// Matches a leading part-of-speech tag: n. / v. / adj. / prep. / conj. …
const POS_TAG = /^[a-z]+\./i;

/**
 * Groups a meaning's "、"-separated senses by part of speech: a sense that
 * starts with a POS tag opens a new line, and any following bare senses join
 * it with "、" so one POS group stays together.
 *   "prep. 为了……、对于……、conj. 因为"
 *     -> ["prep. 为了……、对于……", "conj. 因为"]
 * Returns null when no break is needed: the meaning is short (1-2 senses), or
 * every sense belongs to the same POS group.
 */
function meaningLines(meaning: string): string[] | null {
  const senses = meaning
    .split('、')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (senses.length < 3) return null;
  const lines: string[] = [];
  for (const sense of senses) {
    if (lines.length === 0 || POS_TAG.test(sense)) lines.push(sense);
    else lines[lines.length - 1] += `、${sense}`;
  }
  // One group (e.g. "n. 形式、表格、外观") needs no break.
  return lines.length > 1 ? lines : null;
}

type WordCardProps = {
  position: number;
  text: string;
  meaning: string;
  forms: string[];
  ipa?: string;
  flagged: boolean;
  /** hidden: tap to show · shown: tap to hide · always: pinned visible. */
  meaningMode?: MeaningMode;
  onReplay: () => void;
  onToggleFlagged: () => void;
};

/**
 * The full-screen word card, split into two independent halves so toggling
 * the meaning never shifts anything:
 *   - top: position number, the word, and a fixed-height slot for the meaning
 *   - bottom: supplementary word forms, shown together with the meaning
 * Tap the word to replay it; tap anywhere else to reveal/hide the meaning;
 * tap the bookmark to flag the word as unfamiliar.
 */
export function WordCard({
  position,
  text,
  meaning,
  forms,
  ipa,
  flagged,
  meaningMode = 'hidden',
  onReplay,
  onToggleFlagged,
}: WordCardProps) {
  const { colors } = useTheme();
  const [revealed, setRevealed] = useState(meaningMode === 'shown');
  const meaningVisible = meaningMode === 'always' || revealed;
  const toggleMeaning = () => {
    if (meaningMode === 'always') return;
    setRevealed((v) => !v);
  };

  // Long meanings break onto one line per part-of-speech group; short ones
  // stay on a single line.
  const lines = meaningLines(meaning);

  return (
    <View style={styles.root}>
      <Pressable style={styles.top} onPress={toggleMeaning}>
        <Text style={[styles.position, { color: colors.textSecondary }]}>{position}</Text>
        <Pressable onPress={onReplay} hitSlop={12}>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.5}
            numberOfLines={1}
            style={[styles.word, { color: colors.text }]}>
            {text}
          </Text>
        </Pressable>
        {ipa && ipa.length > 0 && (
          <Text style={[styles.ipa, { color: colors.textTertiary }]}>{ipa}</Text>
        )}
        {/* Reserved slot: keeps number and word anchored while meaning toggles. */}
        <View style={styles.meaningSlot}>
          {meaningVisible && meaning.length > 0 && (
            lines ? (
              <View style={styles.meaningLines}>
                {lines.map((line, i) => (
                  <Text key={i} style={[styles.meaning, { color: colors.textSecondary }]}>
                    {line}
                  </Text>
                ))}
              </View>
            ) : (
              <Text style={[styles.meaning, { color: colors.textSecondary }]}>{meaning}</Text>
            )
          )}
        </View>
      </Pressable>

      <Pressable style={styles.bottom} onPress={toggleMeaning}>
        {meaningVisible && forms.length > 0 && (
          <View style={styles.formsGrid}>
            {Array.from({ length: FORMS_GRID_CELLS }).map((_, i) => (
              <View key={i} style={styles.formCell}>
                {forms[i] != null && (
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={[styles.formText, { color: colors.textTertiary }]}>
                    {forms[i]}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
      </Pressable>

      <Pressable
        style={styles.flag}
        onPress={onToggleFlagged}
        hitSlop={16}
        accessibilityLabel={flagged ? 'Unflag word' : 'Flag word'}>
        <Ionicons
          name={flagged ? 'bookmark' : 'bookmark-outline'}
          size={30}
          color={flagged ? colors.danger : colors.textTertiary}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  top: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  bottom: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  position: {
    fontSize: 28,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    marginBottom: spacing.m,
  },
  word: {
    fontSize: fontSize.word,
    fontWeight: '800',
    textAlign: 'center',
  },
  ipa: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: spacing.s,
  },
  meaningSlot: {
    alignItems: 'center',
    height: 110,
    justifyContent: 'flex-start',
    marginTop: spacing.m,
  },
  meaning: {
    fontSize: 20,
    textAlign: 'center',
  },
  meaningLines: {
    alignItems: 'center',
    gap: spacing.s,
  },
  formsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    // Breathing room before the bookmark; the bottom half vertically centers
    // the grid, but a 6-row grid can still come close to the bookmark area.
    marginBottom: spacing.l,
  },
  formCell: {
    width: '50%',
    height: 28,
    justifyContent: 'center',
    marginBottom: spacing.s,
    paddingHorizontal: spacing.s,
  },
  formText: {
    fontSize: fontSize.caption,
    textAlign: 'left',
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

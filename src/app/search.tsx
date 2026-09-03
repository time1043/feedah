import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { searchWords, type WordRow } from '@/db/repo';
import { useSettings } from '@/db/settings';
import { useTheme } from '@/theme/context';
import { fontSize, spacing } from '@/theme/tokens';

/** Word lookup over the active bucket; results open a single card. */
export default function SearchScreen() {
  const { colors } = useTheme();
  const { settings } = useSettings();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WordRow[]>([]);

  useEffect(() => {
    const trimmed = query.trim();
    if (settings.activeBucketId === '' || trimmed.length === 0) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      void searchWords(settings.activeBucketId, trimmed).then(setResults);
    }, 150);
    return () => clearTimeout(timer);
  }, [query, settings.activeBucketId]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.bar}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={colors.textSecondary} />
        </Pressable>
        <TextInput
          autoFocus
          value={query}
          onChangeText={setQuery}
          placeholder="Search words"
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
        />
      </View>

      <FlatList
        data={results}
        keyExtractor={(word) => `${word.position}`}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
            onPress={() => router.push(`/word/${item.position}`)}>
            <Text style={[styles.position, { color: colors.textTertiary }]}>{item.position}</Text>
            {item.flagged && <View style={[styles.dot, { backgroundColor: colors.danger }]} />}
            <Text style={[styles.word, { color: colors.text }]} numberOfLines={1}>
              {item.text}
            </Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  bar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.s,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
  },
  input: {
    borderRadius: 10,
    flex: 1,
    fontSize: fontSize.body,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: spacing.l,
    paddingVertical: 12,
  },
  position: {
    fontSize: fontSize.caption,
    fontVariant: ['tabular-nums'],
    width: 44,
  },
  dot: {
    borderRadius: 3,
    height: 6,
    marginRight: 6,
    width: 6,
  },
  word: {
    flex: 1,
    fontSize: fontSize.body,
  },
});

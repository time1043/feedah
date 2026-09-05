import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listBuckets, searchWords, type WordRow } from '@/db/repo';
import { useTheme } from '@/theme/context';
import { fontSize, spacing } from '@/theme/tokens';

/**
 * Word lookup. From home it spans every bucket — results are not deduped, on
 * purpose: the same word in two buckets is worth seeing (and a duplicate
 * inside one bucket exposes a data problem instead of hiding it). From the
 * feed it is pinned to that feed's bucket. Results open the word page pinned
 * to the result's bucket.
 */
export default function SearchScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ bucket?: string }>();
  const pinnedBucket =
    typeof params.bucket === 'string' && params.bucket.length > 0 ? params.bucket : '';
  const [scopes, setScopes] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WordRow[]>([]);

  useEffect(() => {
    void (async () => {
      if (pinnedBucket !== '') {
        setScopes([pinnedBucket]);
        return;
      }
      setScopes((await listBuckets()).map((bucket) => bucket.id));
    })();
  }, [pinnedBucket]);

  useEffect(() => {
    const trimmed = query.trim();
    if (scopes.length === 0 || trimmed.length === 0) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      void (async () => {
        const lists = await Promise.all(scopes.map((bucket) => searchWords(bucket, trimmed)));
        setResults(lists.flat());
      })();
    }, 150);
    return () => clearTimeout(timer);
  }, [query, scopes]);

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
        keyExtractor={(word, i) => `${word.bucketId}-${word.position}-${i}`}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
            onPress={() => router.push(`/word/${item.position}?bucket=${item.bucketId}`)}>
            <Text style={[styles.position, { color: colors.textTertiary }]}>{item.position}</Text>
            {item.flagged && <View style={[styles.dot, { backgroundColor: colors.danger }]} />}
            <Text style={[styles.word, { color: colors.text }]} numberOfLines={1}>
              {item.text}
            </Text>
            <Text style={[styles.bucket, { color: colors.textTertiary }]}>{item.bucketId}</Text>
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
  bucket: {
    fontSize: fontSize.caption,
    fontVariant: ['tabular-nums'],
    marginLeft: spacing.s,
  },
});

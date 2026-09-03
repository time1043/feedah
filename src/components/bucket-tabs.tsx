import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/context';
import { fontSize, radius, spacing } from '@/theme/tokens';

type BucketTabsProps = {
  buckets: { id: string }[];
  activeId: string;
  onSelect: (id: string) => void;
};

/**
 * The shared bucket chip row. Every screen renders it as the first element
 * with no extra top padding of its own, so the row sits at exactly the same
 * position everywhere and never shifts between screens.
 */
export function BucketTabs({ buckets, activeId, onSelect }: BucketTabsProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      {buckets.map((bucket) => {
        const active = bucket.id === activeId;
        return (
          <Pressable
            key={bucket.id}
            onPress={() => onSelect(bucket.id)}
            style={[styles.chip, { backgroundColor: active ? colors.accent : colors.surface }]}>
            <Text style={[styles.label, { color: active ? '#FFFFFF' : colors.textSecondary }]}>
              {bucket.id}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.s,
    paddingHorizontal: spacing.m,
    paddingTop: spacing.s,
  },
  chip: {
    borderRadius: radius.l,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
  },
  label: {
    fontSize: fontSize.caption,
    fontWeight: '600',
  },
});

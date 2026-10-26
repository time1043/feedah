import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/context';
import { fontSize, radius, spacing } from '@/theme/tokens';

type BucketTabsProps = {
  buckets: { id: string; name?: string }[];
  activeId: string;
  onSelect: (id: string) => void;
  /** Provided on screens that can open the buckets page (trailing "+" chip). */
  onManage?: () => void;
};

/**
 * The shared bucket chip row. Every screen renders it as the first element
 * with no extra top padding of its own, so the row sits at exactly the same
 * position everywhere and never shifts between screens. Imported buckets join
 * the built-ins here, so the row scrolls horizontally; the trailing chip
 * opens the buckets page where custom buckets are managed.
 */
export function BucketTabs({ buckets, activeId, onSelect, onManage }: BucketTabsProps) {
  const { colors } = useTheme();

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {buckets.map((bucket) => {
          const active = bucket.id === activeId;
          return (
            <Pressable
              key={bucket.id}
              onPress={() => onSelect(bucket.id)}
              style={[styles.chip, { backgroundColor: active ? colors.accent : colors.surface }]}
            >
              <Text style={[styles.label, { color: active ? '#FFFFFF' : colors.textSecondary }]}>
                {bucket.name || bucket.id}
              </Text>
            </Pressable>
          );
        })}
        {onManage && (
          <Pressable
            onPress={onManage}
            style={[styles.chip, styles.manageChip, { borderColor: colors.separator }]}
            accessibilityLabel="Manage buckets"
          >
            <Ionicons name="add" size={16} color={colors.textTertiary} />
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    columnGap: spacing.s,
    flexDirection: 'row',
    paddingHorizontal: spacing.m,
    paddingTop: spacing.s,
  },
  chip: {
    borderRadius: radius.l,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
  },
  manageChip: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minWidth: 36,
  },
  label: {
    fontSize: fontSize.caption,
    fontWeight: '600',
  },
});

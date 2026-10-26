import { useConvexAuth } from '@convex-dev/auth/react';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { router, useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { convex } from '@/cloud/convex';
import {
  deleteCustomBucket,
  getLearningRecordRows,
  getProgress,
  importBucket,
  listBuckets,
  type Bucket,
  type Progress,
} from '@/db/repo';
import { BUNDLED_BUCKETS } from '@/db/seed';
import { useSettings } from '@/db/settings';
import { parseBucketFile, type ImportError } from '@/lib/bucket-file';
import { buildLearningRecords, encodeLearningRecords } from '@/lib/export-records';
import { MODES } from '@/modes';
import { useTheme } from '@/theme/context';
import { fontSize, radius, spacing } from '@/theme/tokens';

// The convex/ directory sits at the repo root, outside the @/* (src) mapping.
import { api } from '../../convex/_generated/api';

const RESERVED_IDS = BUNDLED_BUCKETS.map((file) => file.name);

/** First five validation errors verbatim, then a "+N more" tail. */
function describeErrors(errors: ImportError[]): string {
  const head = errors
    .slice(0, 5)
    .map((error) => `${error.path || 'file'}: ${error.message}`)
    .join('\n');
  return errors.length > 5 ? `${head}\n+${errors.length - 5} more` : head;
}

function exportFileName(now: number): string {
  const d = new Date(now);
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `feedah-records-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(
    d.getHours(),
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}.json`;
}

/**
 * Bucket management: the full bucket list (built-in and imported), custom
 * bucket import/replace/delete, the active study mode, and the learning-
 * records export. Cloud wipes for replace/delete run BEFORE the local write
 * — the sync merge rules are monotonic, so wiping after would let the next
 * pull resurrect the reset state.
 */
export default function BucketsScreen() {
  const { colors } = useTheme();
  const { settings, ready: settingsReady, update } = useSettings();
  const { isAuthenticated } = useConvexAuth();
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [pasteVisible, setPasteVisible] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const list = await listBuckets();
    if (list.length === 0) return; // DB not ready yet; the next focus retries
    setBuckets(list);
    const entries = await Promise.all(
      list.map(async (bucket) => [bucket.id, await getProgress(bucket.id)] as const),
    );
    setProgress(Object.fromEntries(entries));
  }, []);

  useFocusEffect(() => {
    if (settingsReady) void load().catch(() => {});
  });

  /** Wipes the bucket's cloud rows when an account is bound. */
  const wipeCloud = async (bucketId: string): Promise<boolean> => {
    if (!isAuthenticated || !convex) return true;
    try {
      await convex.mutation(api.sync.wipeMyBucketData, { bucketId });
      return true;
    } catch {
      Alert.alert(
        'Needs a connection',
        'The cloud copy could not be erased — nothing was changed. Reconnect and try again.',
      );
      return false;
    }
  };

  const activate = (id: string) => {
    if (id !== settings.activeBucketId) update({ activeBucketId: id });
  };

  const importParsed = async (raw: string, filename?: string) => {
    const parsed = parseBucketFile(raw, { filename, reservedIds: RESERVED_IDS });
    if (!parsed.ok) {
      Alert.alert('Import failed', describeErrors(parsed.errors));
      return;
    }
    const bucket = parsed.bucket;
    const existing = buckets.find((b) => b.id === bucket.id);
    const run = async () => {
      setBusy(true);
      try {
        if (existing) {
          // Content change renumbers positions; the cloud copy must go first
          // or the next pull resurrects the old progress onto new content.
          if (!(await wipeCloud(bucket.id))) return;
        }
        const result = await importBucket(bucket);
        Alert.alert(
          'Imported',
          result.replaced
            ? `Replaced "${bucket.name}" — ${bucket.words.length} cards. Progress for this bucket was reset.`
            : `Imported "${bucket.name}" — ${bucket.words.length} cards.`,
        );
        await load();
      } finally {
        setBusy(false);
      }
    };
    if (existing) {
      Alert.alert(
        'Replace bucket',
        `"${existing.name || existing.id}" already exists. Replace its ${existing.wordCount} words with ${bucket.words.length} new ones? Progress for this bucket resets; flags are cleared.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Replace', style: 'destructive', onPress: () => void run() },
        ],
      );
      return;
    }
    await run();
  };

  const importFromFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    try {
      const raw = await new File(asset.uri).text();
      await importParsed(raw, asset.name);
    } catch {
      Alert.alert('Import failed', 'The file could not be read.');
    }
  };

  const importFromPaste = async () => {
    const raw = pasteText.trim();
    setPasteVisible(false);
    setPasteText('');
    if (raw.length === 0) return;
    await importParsed(raw);
  };

  const confirmDelete = (bucket: Bucket) => {
    Alert.alert(
      'Delete bucket',
      `Delete "${bucket.name || bucket.id}" and its learning records on this device?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            void (async () => {
              setBusy(true);
              try {
                if (!(await wipeCloud(bucket.id))) return;
                await deleteCustomBucket(bucket.id);
                if (settings.activeBucketId === bucket.id) {
                  const remaining = await listBuckets();
                  if (remaining.length > 0) update({ activeBucketId: remaining[0].id });
                }
                await load();
              } finally {
                setBusy(false);
              }
            })(),
        },
      ],
    );
  };

  const exportRecords = async () => {
    setBusy(true);
    try {
      const rows = await getLearningRecordRows();
      const file = buildLearningRecords(rows, {
        appVersion: Constants.expoConfig?.version ?? '0',
        exportedAt: Date.now(),
      });
      const target = new File(Paths.cache, exportFileName(Date.now()));
      if (target.exists) target.delete();
      target.write(encodeLearningRecords(file));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(target.uri, {
          mimeType: 'application/json',
          dialogTitle: 'Export learning records',
        });
      } else {
        Alert.alert('Saved', target.uri);
      }
    } catch {
      Alert.alert('Export failed', 'The records file could not be created.');
    } finally {
      setBusy(false);
    }
  };

  const activeKind = buckets.find((b) => b.id === settings.activeBucketId)?.kind ?? 'word';

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}
    >
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
          <Ionicons name="chevron-down" size={28} color={colors.textTertiary} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Buckets</Text>
        <View style={styles.titleSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>BUCKETS</Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {buckets.map((bucket) => {
            const active = bucket.id === settings.activeBucketId;
            const prog = progress[bucket.id];
            return (
              <View
                key={bucket.id}
                style={[styles.bucketRow, { borderBottomColor: colors.separator }]}
              >
                <Pressable style={styles.bucketMain} onPress={() => activate(bucket.id)}>
                  <View style={styles.bucketTitleRow}>
                    {active && <Ionicons name="checkmark" size={18} color={colors.accent} />}
                    <Text
                      numberOfLines={1}
                      style={[styles.bucketName, { color: active ? colors.accent : colors.text }]}
                    >
                      {bucket.name || bucket.id}
                    </Text>
                    <Text style={[styles.badge, { color: colors.textTertiary }]}>
                      {bucket.kind === 'qa' ? 'qa' : bucket.language || 'en'}
                    </Text>
                    {bucket.source === 'custom' && (
                      <Text style={[styles.badge, { color: colors.textTertiary }]}>custom</Text>
                    )}
                  </View>
                  <Text style={[styles.bucketMeta, { color: colors.textTertiary }]}>
                    {bucket.wordCount} words
                    {prog ? ` · Round ${prog.round} · ${prog.pointer}/${bucket.wordCount}` : ''}
                  </Text>
                </Pressable>
                {bucket.source === 'custom' && (
                  <Pressable
                    onPress={() => confirmDelete(bucket)}
                    hitSlop={12}
                    accessibilityLabel={`Delete ${bucket.name || bucket.id}`}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.danger} />
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>IMPORT</Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Pressable
            style={[styles.actionButton, { opacity: busy ? 0.4 : 1 }]}
            disabled={busy}
            onPress={() => void importFromFile()}
          >
            <Ionicons name="folder-open-outline" size={18} color={colors.text} />
            <Text style={[styles.actionText, { color: colors.text }]}>Choose a JSON file</Text>
          </Pressable>
          <Pressable
            style={[styles.actionButton, { opacity: busy ? 0.4 : 1 }]}
            disabled={busy}
            onPress={() => setPasteVisible(true)}
          >
            <Ionicons name="clipboard-outline" size={18} color={colors.text} />
            <Text style={[styles.actionText, { color: colors.text }]}>Paste JSON</Text>
          </Pressable>
          <Text style={[styles.hint, { color: colors.textTertiary }]}>
            A bucket file is a JSON object: name, optional kind ("word" or "qa"), optional language
            (e.g. "ko"), and words — each with word/meaning (or question/answer), and optional
            ipa/forms. Up to 5000 items.
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>STUDY MODE</Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {MODES.map((mode) => {
            const supported = mode.supports?.(activeKind) ?? true;
            const selected = settings.studyMode === mode.id && supported;
            return (
              <Pressable
                key={mode.id}
                style={[styles.actionButton, { opacity: supported ? 1 : 0.4 }]}
                disabled={!supported}
                onPress={() => update({ studyMode: mode.id })}
              >
                <Ionicons
                  name={selected ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={selected ? colors.accent : colors.textTertiary}
                />
                <View style={styles.modeText}>
                  <Text style={[styles.actionText, { color: colors.text }]}>
                    {mode.displayName}
                  </Text>
                  <Text style={[styles.hint, { color: colors.textTertiary }]}>
                    {mode.description}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>RECORDS</Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Pressable
            style={[styles.actionButton, { opacity: busy ? 0.4 : 1 }]}
            disabled={busy}
            onPress={() => void exportRecords()}
          >
            <Ionicons name="share-outline" size={18} color={colors.text} />
            <Text style={[styles.actionText, { color: colors.text }]}>Export learning records</Text>
          </Pressable>
          <Text style={[styles.hint, { color: colors.textTertiary }]}>
            Progress, rounds, flags and daily stats for every bucket — custom buckets include their
            words. Imported account data is never included.
          </Text>
        </View>
      </ScrollView>

      <Modal
        transparent
        visible={pasteVisible}
        animationType="slide"
        onRequestClose={() => setPasteVisible(false)}
      >
        <Pressable style={styles.sheetOverlay} onPress={() => setPasteVisible(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.separator }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Paste bucket JSON</Text>
            <TextInput
              multiline
              value={pasteText}
              onChangeText={setPasteText}
              placeholder='{"name": "My bucket", "words": [...]}'
              placeholderTextColor={colors.textTertiary}
              style={[
                styles.pasteField,
                { backgroundColor: colors.background, color: colors.text },
              ]}
            />
            <Pressable
              style={[
                styles.primaryButton,
                { backgroundColor: colors.accent, opacity: busy ? 0.4 : 1 },
              ]}
              disabled={busy}
              onPress={() => void importFromPaste()}
            >
              <Text style={styles.primaryButtonText}>Import</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
  },
  title: {
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  titleSpacer: {
    width: 28,
  },
  content: {
    gap: spacing.s,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.m,
  },
  sectionTitle: {
    fontSize: fontSize.caption,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: spacing.s,
  },
  card: {
    borderRadius: radius.l,
    overflow: 'hidden',
  },
  bucketRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
  },
  bucketMain: {
    flex: 1,
    gap: 2,
  },
  bucketTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  bucketName: {
    flexShrink: 1,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  badge: {
    fontSize: fontSize.caption,
  },
  bucketMeta: {
    fontSize: fontSize.caption,
  },
  actionButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.s,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
  },
  actionText: {
    fontSize: fontSize.body,
  },
  modeText: {
    flex: 1,
  },
  hint: {
    fontSize: fontSize.caption,
    lineHeight: 18,
    paddingBottom: spacing.s,
    paddingHorizontal: spacing.m,
  },
  sheetOverlay: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.l,
    borderTopRightRadius: radius.l,
    gap: spacing.s,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.m,
    paddingTop: spacing.s,
  },
  sheetHandle: {
    alignSelf: 'center',
    borderRadius: 2,
    height: 4,
    width: 40,
  },
  sheetTitle: {
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  pasteField: {
    borderRadius: radius.m,
    fontSize: fontSize.caption,
    height: 160,
    padding: spacing.s,
    textAlignVertical: 'top',
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: radius.l,
    paddingVertical: spacing.s,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.body,
    fontWeight: '700',
  },
});

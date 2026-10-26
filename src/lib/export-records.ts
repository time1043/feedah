import type { LearningRecordRows } from '@/db/repo';

export const LEARNING_RECORDS_SCHEMA_VERSION = 1;

/**
 * The learning-records export file. Sections deliberately mirror the cloud
 * sync shapes (compacted per-round position arrays, high-water marks, LWW
 * stamps) so a future restore can replay rows through applyCloudState and
 * inherit the correct merge rules — higher-round-wins progress, reached/
 * flagged/wrong array unions, min-started/max-finished history, max daily
 * stats and pointers, flaggedAt-LWW flags — for free.
 *
 * Settings/meta are intentionally absent: the meta table holds the bound
 * account email, and records are about learning, not identity.
 */
export type LearningRecordsFile = {
  schemaVersion: typeof LEARNING_RECORDS_SCHEMA_VERSION;
  app: 'feedah';
  appVersion: string;
  exportedAt: number;
  buckets: {
    id: string;
    name: string;
    kind: 'word' | 'qa';
    language: string;
    source: 'builtin' | 'custom';
    wordCount: number;
    /** Custom buckets only — their word banks are unrecoverable otherwise. */
    words?: {
      position: number;
      text: string;
      ipa: string;
      meaning: string;
      forms: string[];
    }[];
    progress: { round: number; pointer: number; startedAt: number; progressUpdatedAt: number };
    roundHistory: { round: number; startedAt: number; finishedAt: number }[];
    roundWord: { round: number; reached: number[]; flagged: number[]; wrong: number[] }[];
    flags: { position: number; flaggedAt: number }[];
    dailyPointer: { day: string; globalPosition: number }[];
  }[];
  dailyStat: { day: string; feedSeconds: number; appSeconds: number }[];
};

/** Compacts per-word round rows into the cloud doc shape (sorted arrays). */
export function compactRoundWords(
  rows: LearningRecordRows['buckets'][number]['roundWords'],
): LearningRecordsFile['buckets'][number]['roundWord'] {
  type Agg = { reached: Set<number>; flagged: Set<number>; wrong: Set<number> };
  const byRound = new Map<number, Agg>();
  for (const row of rows) {
    let agg = byRound.get(row.round);
    if (!agg) {
      agg = { reached: new Set(), flagged: new Set(), wrong: new Set() };
      byRound.set(row.round, agg);
    }
    if (row.reached) agg.reached.add(row.position);
    if (row.flagged) agg.flagged.add(row.position);
    if (row.wrong) agg.wrong.add(row.position);
  }
  const sorted = (set: Set<number>): number[] => Array.from(set).sort((a, b) => a - b);
  return Array.from(byRound.entries())
    .sort(([a], [b]) => a - b)
    .map(([round, agg]) => {
      const reached = sorted(agg.reached);
      const flagged = sorted(agg.flagged);
      const wrong = sorted(agg.wrong);
      return { round, reached, flagged, wrong };
    })
    .filter((r) => r.reached.length > 0 || r.flagged.length > 0 || r.wrong.length > 0);
}

export function buildLearningRecords(
  rows: LearningRecordRows,
  meta: { appVersion: string; exportedAt: number },
): LearningRecordsFile {
  return {
    schemaVersion: LEARNING_RECORDS_SCHEMA_VERSION,
    app: 'feedah',
    appVersion: meta.appVersion,
    exportedAt: meta.exportedAt,
    buckets: rows.buckets.map((entry) => ({
      id: entry.bucket.id,
      name: entry.bucket.name,
      kind: entry.bucket.kind,
      language: entry.bucket.language,
      source: entry.bucket.source,
      wordCount: entry.bucket.wordCount,
      ...(entry.bucket.source === 'custom' && entry.words.length > 0 ? { words: entry.words } : {}),
      progress: entry.progress,
      roundHistory: entry.history,
      roundWord: compactRoundWords(entry.roundWords),
      flags: entry.flags,
      dailyPointer: entry.dailyPointers,
    })),
    dailyStat: rows.dailyStats,
  };
}

export function encodeLearningRecords(file: LearningRecordsFile): string {
  return JSON.stringify(file, null, 2);
}

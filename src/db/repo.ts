import { getDb } from './index';
import { DEFAULT_BUCKET_ID } from './seed';
import { dayBounds, todayLocalDate } from '@/lib/date';

export type Bucket = { id: string; wordCount: number };

export type Progress = { round: number; pointer: number; startedAt: number };

export type WordRow = {
  bucketId: string;
  position: number;
  text: string;
  ipa: string;
  meaning: string;
  forms: string[];
  flagged: boolean;
};

export type RoundWordRow = { position: number; reached: boolean; flagged: boolean };

export type RoundHistoryRow = {
  bucketId: string;
  round: number;
  startedAt: number;
  finishedAt: number;
};

export type DailyStatRow = { day: string; feedSeconds: number; appSeconds: number };

export type DailyPointerRow = { day: string; bucketId: string; globalPosition: number };

type WordDbRow = {
  bucket_id: string;
  position: number;
  text: string;
  ipa: string;
  meaning: string;
  forms: string;
  flagged: number;
};

function toWord(row: WordDbRow): WordRow {
  let forms: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.forms);
    if (Array.isArray(parsed)) forms = parsed.filter((f): f is string => typeof f === 'string');
  } catch {
    forms = [];
  }
  return {
    bucketId: row.bucket_id,
    position: row.position,
    text: row.text,
    ipa: row.ipa,
    meaning: row.meaning,
    forms,
    flagged: row.flagged === 1,
  };
}

export async function listBuckets(): Promise<Bucket[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; word_count: number }>(
    'SELECT id, word_count FROM bucket ORDER BY word_count DESC',
  );
  return rows.map((r) => ({ id: r.id, wordCount: r.word_count }));
}

export async function getActiveBucketId(): Promise<string> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM meta WHERE key = ?',
    ['activeBucketId'],
  );
  return row?.value ?? DEFAULT_BUCKET_ID;
}

export async function getProgress(bucketId: string): Promise<Progress> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ round: number; pointer: number; started_at: number }>(
    'SELECT round, pointer, started_at FROM bucket_progress WHERE bucket_id = ?',
    [bucketId],
  );
  return { round: row?.round ?? 1, pointer: row?.pointer ?? 0, startedAt: row?.started_at ?? 0 };
}

export async function getWordCount(bucketId: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ word_count: number }>(
    'SELECT word_count FROM bucket WHERE id = ?',
    [bucketId],
  );
  return row?.word_count ?? 0;
}

export async function getWord(bucketId: string, position: number): Promise<WordRow | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<WordDbRow>(
    'SELECT * FROM word WHERE bucket_id = ? AND position = ?',
    [bucketId, position],
  );
  return row ? toWord(row) : null;
}

export async function getWords(bucketId: string): Promise<WordRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<WordDbRow>(
    'SELECT * FROM word WHERE bucket_id = ? ORDER BY position',
    [bucketId],
  );
  return rows.map(toWord);
}

export async function searchWords(
  bucketId: string,
  query: string,
  options: { matchMeaning?: boolean; limit?: number } = {},
): Promise<WordRow[]> {
  const { matchMeaning = false, limit = 100 } = options;
  const db = await getDb();
  const needle = query.trim();
  const condition = matchMeaning
    ? 'instr(lower(text), lower(?)) > 0 OR instr(lower(meaning), lower(?)) > 0'
    : 'instr(lower(text), lower(?)) > 0';
  const params = matchMeaning
    ? [bucketId, needle, needle, limit]
    : [bucketId, needle, limit];
  const rows = await db.getAllAsync<WordDbRow>(
    `SELECT * FROM word
     WHERE bucket_id = ? AND (${condition})
     ORDER BY position LIMIT ?`,
    params,
  );
  return rows.map(toWord);
}

/**
 * Records a hand-settled card: marks the word reached in the current round and
 * moves the monotonic pointer forward. Only the settled position is marked —
 * positions skipped by a drag jump stay unreached. Starting a new round is
 * handled separately by startNextRound.
 */
export async function advancePointer(bucketId: string, position: number): Promise<Progress> {
  const db = await getDb();
  const before = await getProgress(bucketId);
  if (position <= before.pointer) return before;

  const wordCount = await getWordCount(bucketId);
  const flagged = await db.getFirstAsync<{ flagged: number }>(
    'SELECT flagged FROM word WHERE bucket_id = ? AND position = ?',
    [bucketId, position],
  );

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO round_word (bucket_id, round, position, reached, flagged, reached_at)
       VALUES (?, ?, ?, 1, ?, ?)
       ON CONFLICT(bucket_id, round, position) DO UPDATE SET reached = 1, reached_at = excluded.reached_at`,
      [bucketId, before.round, position, flagged?.flagged === 1 ? 1 : 0, Date.now()],
    );
    await db.runAsync(
      'UPDATE bucket_progress SET pointer = ? WHERE bucket_id = ?',
      [position, bucketId],
    );
    await db.runAsync(
      `INSERT INTO daily_pointer (day, bucket_id, global_position) VALUES (?, ?, ?)
       ON CONFLICT(day, bucket_id) DO UPDATE SET global_position = excluded.global_position`,
      [todayLocalDate(), bucketId, (before.round - 1) * wordCount + position],
    );
  });

  return { ...before, pointer: position };
}

/** Moves to the next round after the previous one was fully walked through. */
export async function startNextRound(bucketId: string): Promise<Progress> {
  const db = await getDb();
  const before = await getProgress(bucketId);
  const wordCount = await getWordCount(bucketId);
  // Idempotent: only advance from a fully walked-through round, so a
  // duplicated settle on the round-end card cannot skip a round.
  if (before.pointer < wordCount) return before;
  const now = Date.now();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT OR REPLACE INTO round_history (bucket_id, round, started_at, finished_at) VALUES (?, ?, ?, ?)',
      [bucketId, before.round, before.startedAt > 0 ? before.startedAt : now, now],
    );
    await db.runAsync(
      'UPDATE bucket_progress SET round = ?, pointer = 0, started_at = ? WHERE bucket_id = ?',
      [before.round + 1, now, bucketId],
    );
  });

  return { round: before.round + 1, pointer: 0, startedAt: now };
}

/** Toggles the flag on a word and records it against the current round. */
export async function setFlag(
  bucketId: string,
  position: number,
  flagged: boolean,
): Promise<void> {
  const db = await getDb();
  const { round } = await getProgress(bucketId);

  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE word SET flagged = ? WHERE bucket_id = ? AND position = ?', [
      flagged ? 1 : 0,
      bucketId,
      position,
    ]);
    if (flagged) {
      await db.runAsync(
        `INSERT INTO round_word (bucket_id, round, position, reached, flagged)
         VALUES (?, ?, ?, 0, 1)
         ON CONFLICT(bucket_id, round, position) DO UPDATE SET flagged = 1`,
        [bucketId, round, position],
      );
    } else {
      const row = await db.getFirstAsync<{ reached: number }>(
        'SELECT reached FROM round_word WHERE bucket_id = ? AND round = ? AND position = ?',
        [bucketId, round, position],
      );
      if (row && row.reached === 0) {
        await db.runAsync(
          'DELETE FROM round_word WHERE bucket_id = ? AND round = ? AND position = ?',
          [bucketId, round, position],
        );
      } else if (row) {
        await db.runAsync(
          'UPDATE round_word SET flagged = 0 WHERE bucket_id = ? AND round = ? AND position = ?',
          [bucketId, round, position],
        );
      }
    }
  });
}

export async function getFlaggedWords(bucketId: string): Promise<WordRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<WordDbRow>(
    'SELECT * FROM word WHERE bucket_id = ? AND flagged = 1 ORDER BY position',
    [bucketId],
  );
  return rows.map(toWord);
}

/** Words that were flagged during a specific round (historical snapshot). */
export async function getRoundFlaggedWords(bucketId: string, round: number): Promise<WordRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<WordDbRow>(
    `SELECT w.* FROM word w
     JOIN round_word rw ON rw.bucket_id = w.bucket_id AND rw.position = w.position
     WHERE w.bucket_id = ? AND rw.round = ? AND rw.flagged = 1
     ORDER BY w.position`,
    [bucketId, round],
  );
  return rows.map(toWord);
}

/** Distinct words completed on a local day, across all buckets. */
export async function getWordsCompletedOn(day: string): Promise<WordRow[]> {
  const db = await getDb();
  const { start, end } = dayBounds(day);
  const rows = await db.getAllAsync<WordDbRow>(
    `SELECT DISTINCT w.* FROM word w
     JOIN round_word rw ON rw.bucket_id = w.bucket_id AND rw.position = w.position
     WHERE rw.reached_at >= ? AND rw.reached_at < ?
     ORDER BY w.bucket_id, w.position`,
    [start, end],
  );
  return rows.map(toWord);
}

export async function countFlaggedWords(bucketId: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM word WHERE bucket_id = ? AND flagged = 1',
    [bucketId],
  );
  return row?.n ?? 0;
}

/** Green/red counts for the current round, matching the stats timelines. */
export async function getRoundFlagCounts(bucketId: string): Promise<{ green: number; red: number }> {
  const db = await getDb();
  const { round } = await getProgress(bucketId);
  const rows = await db.getAllAsync<{ reached: number; flagged: number }>(
    'SELECT reached, flagged FROM round_word WHERE bucket_id = ? AND round = ?',
    [bucketId, round],
  );
  let green = 0;
  let red = 0;
  for (const row of rows) {
    if (row.flagged === 1) red += 1;
    else if (row.reached === 1) green += 1;
  }
  return { green, red };
}

export async function getRoundHistory(bucketId: string): Promise<RoundHistoryRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    bucket_id: string;
    round: number;
    started_at: number;
    finished_at: number;
  }>('SELECT * FROM round_history WHERE bucket_id = ? ORDER BY round', [bucketId]);
  return rows.map((r) => ({
    bucketId: r.bucket_id,
    round: r.round,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
  }));
}

export async function getRoundWords(bucketId: string, round: number): Promise<RoundWordRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ position: number; reached: number; flagged: number }>(
    'SELECT position, reached, flagged FROM round_word WHERE bucket_id = ? AND round = ? ORDER BY position',
    [bucketId, round],
  );
  return rows.map((r) => ({ position: r.position, reached: r.reached === 1, flagged: r.flagged === 1 }));
}

export async function addDailyTime(day: string, feedSeconds: number, appSeconds: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO daily_stat (day, feed_seconds, app_seconds) VALUES (?, ?, ?)
     ON CONFLICT(day) DO UPDATE SET
       feed_seconds = feed_seconds + excluded.feed_seconds,
       app_seconds = app_seconds + excluded.app_seconds`,
    [day, feedSeconds, appSeconds],
  );
}

export async function listDailyStats(): Promise<DailyStatRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ day: string; feed_seconds: number; app_seconds: number }>(
    'SELECT day, feed_seconds, app_seconds FROM daily_stat ORDER BY day',
  );
  return rows.map((r) => ({ day: r.day, feedSeconds: r.feed_seconds, appSeconds: r.app_seconds }));
}

export async function listDailyPointers(): Promise<DailyPointerRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ day: string; bucket_id: string; global_position: number }>(
    'SELECT day, bucket_id, global_position FROM daily_pointer ORDER BY day',
  );
  return rows.map((r) => ({ day: r.day, bucketId: r.bucket_id, globalPosition: r.global_position }));
}

export async function getDailyStat(day: string): Promise<DailyStatRow | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ day: string; feed_seconds: number; app_seconds: number }>(
    'SELECT day, feed_seconds, app_seconds FROM daily_stat WHERE day = ?',
    [day],
  );
  return row ? { day: row.day, feedSeconds: row.feed_seconds, appSeconds: row.app_seconds } : null;
}

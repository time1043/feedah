import { getDb } from './index'
import { bucket } from './schema/bucket-word'
import { dailyPointer, dailyStat } from './schema/daily'
import { reviewSession } from './schema/review-session'
import { bucketProgress, roundFlag, roundRecord } from './schema/study-round'

export type ExportedBucket = {
  name: string
  wordCount: number
  contentHash: string
  /** Deletion tombstone (epoch ms): the bucket is hidden but every row —
   * and therefore its statistics contribution — is still here. */
  deletedAt: number | null
  progress: { round: number; pointer: number; roundStartedAt: number }
  rounds: { round: number; startedAt: number; endedAt: number }[]
  flags: { round: number; position: number; flaggedAt: number }[]
  reviewSessions: {
    counted: boolean
    number: number | null
    queue: number[]
    startedAt: number
    finishedAt: number | null
    lastPosition: number
  }[]
  dailyPointers: { day: string; globalPosition: number }[]
}

export type StudyExport = {
  format: 'feedah-study-export'
  version: 2
  exportedAt: string
  dailyStats: { day: string; feedSeconds: number; appSeconds: number }[]
  buckets: ExportedBucket[]
}

/**
 * Reads every study-state table and builds the export JSON. Word content is
 * intentionally excluded: bundled buckets re-seed from data/*.json on
 * install, and user-imported buckets go through the import-bucket pipeline.
 * The export carries only user-generated study state.
 */
export async function buildStudyExport(): Promise<StudyExport> {
  const db = await getDb()
  const [bucketRows, progressRows, recordRows, flagRows, sessionRows, pointerRows, statRows] =
    await Promise.all([
      db.select().from(bucket).orderBy(bucket.name),
      db.select().from(bucketProgress),
      db.select().from(roundRecord).orderBy(roundRecord.bucketName, roundRecord.round),
      db
        .select()
        .from(roundFlag)
        .orderBy(roundFlag.bucketName, roundFlag.round, roundFlag.position),
      db.select().from(reviewSession).orderBy(reviewSession.bucketName, reviewSession.round),
      db.select().from(dailyPointer).orderBy(dailyPointer.day, dailyPointer.bucketName),
      db.select().from(dailyStat).orderBy(dailyStat.day),
    ])

  const progressByBucket = new Map(progressRows.map((row) => [row.bucketName, row]))
  const recordsByBucket = new Map<string, typeof recordRows>()
  for (const row of recordRows) {
    const list = recordsByBucket.get(row.bucketName)
    if (list) list.push(row)
    else recordsByBucket.set(row.bucketName, [row])
  }
  const flagsByBucket = new Map<string, typeof flagRows>()
  for (const row of flagRows) {
    const list = flagsByBucket.get(row.bucketName)
    if (list) list.push(row)
    else flagsByBucket.set(row.bucketName, [row])
  }
  const sessionsByBucket = new Map<string, typeof sessionRows>()
  for (const row of sessionRows) {
    const list = sessionsByBucket.get(row.bucketName)
    if (list) list.push(row)
    else sessionsByBucket.set(row.bucketName, [row])
  }
  const pointersByBucket = new Map<string, typeof pointerRows>()
  for (const row of pointerRows) {
    const list = pointersByBucket.get(row.bucketName)
    if (list) list.push(row)
    else pointersByBucket.set(row.bucketName, [row])
  }
  return {
    format: 'feedah-study-export',
    version: 2,
    exportedAt: new Date().toISOString(),
    dailyStats: statRows.map((row) => ({
      day: row.day,
      feedSeconds: row.feedSeconds,
      appSeconds: row.appSeconds,
    })),
    buckets: bucketRows.map((bucketRow) => {
      const progress = progressByBucket.get(bucketRow.name)
      const records = recordsByBucket.get(bucketRow.name) ?? []
      return {
        name: bucketRow.name,
        wordCount: bucketRow.wordCount,
        contentHash: bucketRow.contentHash,
        deletedAt: bucketRow.deletedAt ?? null,
        progress: {
          round: progress?.round ?? 1,
          pointer: progress?.pointer ?? 0,
          roundStartedAt: progress?.roundStartedAt ?? 0,
        },
        rounds: records.map((row) => ({
          round: row.round,
          startedAt: row.startedAt,
          endedAt: row.endedAt,
        })),
        flags: (flagsByBucket.get(bucketRow.name) ?? []).map((row) => ({
          round: row.round,
          position: row.position,
          flaggedAt: row.flaggedAt,
        })),
        reviewSessions: (sessionsByBucket.get(bucketRow.name) ?? []).map((row) => ({
          counted: row.counted,
          number: row.number,
          queue: row.queue,
          startedAt: row.startedAt,
          finishedAt: row.finishedAt,
          lastPosition: row.lastPosition,
        })),
        dailyPointers: (pointersByBucket.get(bucketRow.name) ?? []).map((row) => ({
          day: row.day,
          globalPosition: row.globalPosition,
        })),
      }
    }),
  }
}

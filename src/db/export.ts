import { and, eq } from 'drizzle-orm'

import { getDb } from './index'
import {
  answerLog,
  bucket,
  bucketProgress,
  dailyPointer,
  dailyStat,
  roundFlag,
  roundHistory,
  reviewSession,
} from './schema'

export type ExportedBucket = {
  id: string
  wordCount: number
  contentHash: string
  progress: { round: number; pointer: number; roundStartedAt: number }
  rounds: { round: number; startedAt: number; finishedAt: number }[]
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
  answers: {
    round: number
    position: number
    mode: string
    correct: boolean
    answeredAt: number
  }[]
}

export type StudyExport = {
  format: 'feedah-study-export'
  version: 1
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
  const [
    bucketRows,
    progressRows,
    historyRows,
    flagRows,
    sessionRows,
    pointerRows,
    statRows,
    answerRows,
  ] = await Promise.all([
    db.select().from(bucket).orderBy(bucket.id),
    db.select().from(bucketProgress),
    db.select().from(roundHistory).orderBy(roundHistory.bucketId, roundHistory.round),
    db.select().from(roundFlag).orderBy(roundFlag.bucketId, roundFlag.round, roundFlag.position),
    db.select().from(reviewSession).orderBy(reviewSession.bucketId, reviewSession.round),
    db.select().from(dailyPointer).orderBy(dailyPointer.day, dailyPointer.bucketId),
    db.select().from(dailyStat).orderBy(dailyStat.day),
    db.select().from(answerLog).orderBy(answerLog.bucketId, answerLog.round),
  ])

  const progressByBucket = new Map(progressRows.map((row) => [row.bucketId, row]))
  const historyByBucket = new Map<string, typeof historyRows>()
  for (const row of historyRows) {
    const list = historyByBucket.get(row.bucketId)
    if (list) list.push(row)
    else historyByBucket.set(row.bucketId, [row])
  }
  const flagsByBucket = new Map<string, typeof flagRows>()
  for (const row of flagRows) {
    const list = flagsByBucket.get(row.bucketId)
    if (list) list.push(row)
    else flagsByBucket.set(row.bucketId, [row])
  }
  const sessionsByBucket = new Map<string, typeof sessionRows>()
  for (const row of sessionRows) {
    const list = sessionsByBucket.get(row.bucketId)
    if (list) list.push(row)
    else sessionsByBucket.set(row.bucketId, [row])
  }
  const pointersByBucket = new Map<string, typeof pointerRows>()
  for (const row of pointerRows) {
    const list = pointersByBucket.get(row.bucketId)
    if (list) list.push(row)
    else pointersByBucket.set(row.bucketId, [row])
  }
  const answersByBucket = new Map<string, typeof answerRows>()
  for (const row of answerRows) {
    const list = answersByBucket.get(row.bucketId)
    if (list) list.push(row)
    else answersByBucket.set(row.bucketId, [row])
  }

  return {
    format: 'feedah-study-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    dailyStats: statRows.map((row) => ({
      day: row.day,
      feedSeconds: row.feedSeconds,
      appSeconds: row.appSeconds,
    })),
    buckets: bucketRows.map((bucketRow) => {
      const progress = progressByBucket.get(bucketRow.id)
      const history = historyByBucket.get(bucketRow.id) ?? []
      const flags = (flagsByBucket.get(bucketRow.id) ?? []).map((row) => ({
        round: row.round,
        position: row.position,
        flaggedAt: row.flaggedAt,
      }))
      const sessions = (sessionsByBucket.get(bucketRow.id) ?? []).map((row) => ({
        counted: row.counted,
        number: row.number,
        queue: row.queue,
        startedAt: row.startedAt,
        finishedAt: row.finishedAt,
        lastPosition: row.lastPosition,
      }))
      const pointers = (pointersByBucket.get(bucketRow.id) ?? []).map((row) => ({
        day: row.day,
        globalPosition: row.globalPosition,
      }))
      const answers = (answersByBucket.get(bucketRow.id) ?? []).map((row) => ({
        round: row.round,
        position: row.position,
        mode: row.mode,
        correct: row.correct,
        answeredAt: row.answeredAt,
      }))
      return {
        id: bucketRow.id,
        wordCount: bucketRow.wordCount,
        contentHash: bucketRow.contentHash,
        progress: {
          round: progress?.round ?? 1,
          pointer: progress?.pointer ?? 0,
          roundStartedAt: progress?.roundStartedAt ?? 0,
        },
        rounds: history.map((row) => ({
          round: row.round,
          startedAt: row.startedAt,
          finishedAt: row.finishedAt,
        })),
        flags,
        reviewSessions: sessions,
        dailyPointers: pointers,
        answers,
      }
    }),
  }
}

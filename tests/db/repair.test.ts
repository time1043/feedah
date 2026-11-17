//
// The one-time pointer repair: the pre-settled-count snapshot stored the
// parked card's 1-based ordinal (settled + 1) on mid-round rows; the repair
// drops exactly that phantom card, keeps completion rows (multiples of the
// word count) and — the safety property — can never run twice.
//

import AsyncStorage from '@react-native-async-storage/async-storage'
import { eq } from 'drizzle-orm'

import { getDb } from '@/db/index'
import { repairLegacyDailyPointers } from '@/db/repair'
import { bucket } from '@/db/schema/bucket-word'
import { dailyPointer } from '@/db/schema/daily'

import { resetDb, type dbIndex } from './harness'

const mockStore = new Map<string, string>()

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value)
  }),
}))

jest.mock('@/db/index', () => {
  const harness = jest.requireActual<{ dbIndex: typeof dbIndex }>('./harness')
  return harness.dbIndex()
})

const mockSetItem = AsyncStorage.setItem as jest.Mock

async function insertBucket(name: string, wordCount: number): Promise<void> {
  const db = await getDb()
  await db.insert(bucket).values({ name, wordCount })
}

async function insertPointer(
  day: string,
  bucketName: string,
  globalPosition: number,
): Promise<void> {
  const db = await getDb()
  await db.insert(dailyPointer).values({ day, bucketName, globalPosition })
}

async function pointerOf(bucketName: string, day: string): Promise<number> {
  const db = await getDb()
  const rows = await db
    .select({ day: dailyPointer.day, globalPosition: dailyPointer.globalPosition })
    .from(dailyPointer)
    .where(eq(dailyPointer.bucketName, bucketName))
  return rows.find((row) => row.day === day)?.globalPosition ?? -1
}

beforeEach(() => {
  mockStore.clear()
  resetDb()
})

describe('repairLegacyDailyPointers', () => {
  it('drops the phantom card from mid-round rows and keeps completion rows', async () => {
    await insertBucket('a', 2050)
    await insertBucket('b', 370)
    // Mid-round settles under the old snapshot: settled + 1.
    await insertPointer('2026-11-17', 'a', 8)
    await insertPointer('2026-11-18', 'b', 25)
    // Completion rows were always exact (a multiple of the word count).
    await insertPointer('2026-11-18', 'a', 2050)
    await insertPointer('2026-11-17', 'b', 370)

    await repairLegacyDailyPointers(await getDb())

    expect(await pointerOf('a', '2026-11-17')).toBe(7)
    expect(await pointerOf('b', '2026-11-18')).toBe(24)
    expect(await pointerOf('a', '2026-11-18')).toBe(2050)
    expect(await pointerOf('b', '2026-11-17')).toBe(370)
  })

  it('runs once: later opens never rewrite rows again', async () => {
    await insertBucket('a', 2050)
    await insertPointer('2026-11-17', 'a', 8)
    await repairLegacyDailyPointers(await getDb())
    expect(await pointerOf('a', '2026-11-17')).toBe(7)

    // A new-semantics row (already the settled count) written after the
    // first run must survive every later run — the flag makes the repair a
    // no-op from here on.
    await insertPointer('2026-11-18', 'a', 9)
    await repairLegacyDailyPointers(await getDb())
    expect(await pointerOf('a', '2026-11-18')).toBe(9)
    expect(await pointerOf('a', '2026-11-17')).toBe(7)
  })

  it('skips the rows when the guard cannot be set', async () => {
    await insertBucket('a', 2050)
    await insertPointer('2026-11-17', 'a', 8)
    mockSetItem.mockRejectedValueOnce(new Error('storage unavailable'))

    await repairLegacyDailyPointers(await getDb())

    // An unguardable run must not touch the rows: a repair without its flag
    // would run again on the next open and subtract twice.
    expect(await pointerOf('a', '2026-11-17')).toBe(8)
  })
})

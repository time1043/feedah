import { todayLocalDate } from '@/lib/date'

import { addDailyTime } from './repo'

/**
 * Tracks two daily time metrics while the app is in the foreground: total
 * app time and time spent on the study decks (feed/review). Seconds are
 * accumulated in memory and flushed to daily_stat on a fixed interval, on
 * app state changes, and on card settles, so a crash loses at most one
 * interval.
 */

let appStartedAt: number | null = null
let studyStartedAt: number | null = null
let pendingAppMs = 0
let pendingStudyMs = 0
let interval: ReturnType<typeof setInterval> | null = null
let flushing = false

function tick(now: number = Date.now()): void {
  if (appStartedAt !== null) {
    pendingAppMs += now - appStartedAt
    appStartedAt = now
  }
  if (studyStartedAt !== null) {
    pendingStudyMs += now - studyStartedAt
    studyStartedAt = now
  }
}

export async function flushUsage(): Promise<void> {
  if (flushing) return
  flushing = true
  try {
    tick()
    const feedSeconds = Math.floor(pendingStudyMs / 1000)
    const appSeconds = Math.floor(pendingAppMs / 1000)
    pendingStudyMs -= feedSeconds * 1000
    pendingAppMs -= appSeconds * 1000
    if (feedSeconds > 0 || appSeconds > 0) {
      await addDailyTime(todayLocalDate(), feedSeconds, appSeconds)
    }
  } finally {
    flushing = false
  }
}

export function startAppUsage(): void {
  if (appStartedAt === null) appStartedAt = Date.now()
  if (interval === null) {
    interval = setInterval(() => {
      void flushUsage()
    }, 10_000)
  }
}

export function pauseAppUsage(): void {
  tick()
  appStartedAt = null
}

export function startStudyUsage(): void {
  if (studyStartedAt === null) studyStartedAt = Date.now()
}

export function pauseStudyUsage(): void {
  tick()
  studyStartedAt = null
}

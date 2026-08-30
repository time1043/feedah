import { addDailyTime } from './repo';
import { todayLocalDate } from '@/lib/date';

/**
 * Tracks two daily time metrics while the app is in the foreground:
 * total app time and time spent on the feed screen. Seconds are accumulated
 * in memory and flushed to daily_stat on a fixed interval, on app state
 * changes, and on feed settle events, so a crash loses at most one interval.
 */

let appStartedAt: number | null = null;
let feedStartedAt: number | null = null;
let pendingAppMs = 0;
let pendingFeedMs = 0;
let interval: ReturnType<typeof setInterval> | null = null;
let flushing = false;

function tick(now: number = Date.now()): void {
  if (appStartedAt !== null) {
    pendingAppMs += now - appStartedAt;
    appStartedAt = now;
  }
  if (feedStartedAt !== null) {
    pendingFeedMs += now - feedStartedAt;
    feedStartedAt = now;
  }
}

export async function flushUsage(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    tick();
    const feedSeconds = Math.floor(pendingFeedMs / 1000);
    const appSeconds = Math.floor(pendingAppMs / 1000);
    pendingFeedMs -= feedSeconds * 1000;
    pendingAppMs -= appSeconds * 1000;
    if (feedSeconds > 0 || appSeconds > 0) {
      await addDailyTime(todayLocalDate(), feedSeconds, appSeconds);
    }
  } finally {
    flushing = false;
  }
}

export function startAppUsage(): void {
  if (appStartedAt === null) appStartedAt = Date.now();
  if (interval === null) {
    interval = setInterval(() => {
      void flushUsage();
    }, 10_000);
  }
}

export function pauseAppUsage(): void {
  tick();
  appStartedAt = null;
}

export function startFeedUsage(): void {
  if (feedStartedAt === null) feedStartedAt = Date.now();
}

export function pauseFeedUsage(): void {
  tick();
  feedStartedAt = null;
}

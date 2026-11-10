const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** The readout for a stamp that does not exist (0, or an unfinished span). */
const UNKNOWN = '—'

function two(value: number): string {
  return String(value).padStart(2, '0')
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/**
 * A wall-clock stamp for the round list: "14:05" when it happened today,
 * "Nov 10, 14:05" otherwise. Hand-formatted on purpose — the date/time
 * readout must not depend on the platform's Intl/locale data, and the list is
 * English-only like the rest of the chrome. `now` is injectable for tests.
 */
export function formatStamp(ms: number, now: number = Date.now()): string {
  if (!(ms > 0)) return UNKNOWN
  const date = new Date(ms)
  const clock = `${two(date.getHours())}:${two(date.getMinutes())}`
  if (isSameDay(date, new Date(now))) return clock
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${clock}`
}

/**
 * How long a round took: "38s", "6m 32s", "1h 5m". An unknown start or a
 * span that does not run forwards reads as "—" rather than a made-up
 * duration — the round_record's startedAt is 0 when it was never stamped.
 */
export function formatSpan(startedAt: number, endedAt: number): string {
  if (!(startedAt > 0)) return UNKNOWN
  const ms = endedAt - startedAt
  if (!Number.isFinite(ms) || ms < 0) return UNKNOWN
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

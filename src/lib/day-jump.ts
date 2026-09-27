/**
 * One-shot handoff from the stats heatmap to the words tab: tapping a day
 * asks the words list to open at that day's first completed word, its bucket
 * winning the tab (the same canonical order the day review queue uses). Tab
 * screens cannot receive params, so stats writes the request and the words
 * tab consumes it on its next focus. The signal lives in memory only — a
 * handoff that outlived the app would yank the list to a stale day on the
 * next launch. Plain tab switches never write it, so a browse through the
 * list is never re-anchored.
 */

let pending: string | null = null;

export function requestDayJump(day: string): void {
  pending = day;
}

/** Returns and clears the pending day, if any. */
export function consumeDayJump(): string | null {
  const day = pending;
  pending = null;
  return day;
}

/**
 * The stats heatmap's selected day, published for the words tab: the list
 * anchors at that day's first completed word — its bucket winning the tab —
 * or, for a day without records, back at the very first word. Tab screens
 * cannot receive params, so stats publishes and the words tab reads on its
 * next focus. Stats publishes wherever its selection changes — heatmap taps
 * and the focus reset to today alike — so the list always ends up mirroring
 * the heatmap.
 *
 * Consumption is change-detection, not one-shot: the list re-anchors only
 * when the day differs from the one it last positioned for, so flipping tabs
 * with the day unchanged never drags a mid-list browse. Memory only — a
 * stale day must not outlive the app.
 */

let published: string | null = null;
let applied: string | null = null;

export function publishSelectedDay(day: string): void {
  published = day;
}

/** Returns the newly selected day if the list hasn't positioned for it yet. */
export function consumeSelectedDayChange(): string | null {
  if (published === null || published === applied) return null;
  applied = published;
  return published;
}

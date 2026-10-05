/**
 * Swallows navigation presses that pile up while the app is busy. Opening a
 * data-heavy destination can hold the JS thread just long enough that a tap
 * looks unanswered — and every extra tap then dispatches its own push once
 * the thread frees, stacking duplicate pages. The first press inside the
 * window wins: queued taps all dispatch together after the freeze, so they
 * land inside one window and only the first goes through. A genuine second
 * navigation self-heals — the next tap after the window opens works.
 */

const WINDOW_MS = 800;

let lastAt = 0;

export function pushOnce(push: () => void): void {
  const now = Date.now();
  if (now - lastAt < WINDOW_MS) return;
  lastAt = now;
  push();
}

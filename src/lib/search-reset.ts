/**
 * One-shot signal from the word page to the search page below it: its search
 * icon goes back to that search for a fresh lookup — bar emptied, keyboard
 * up — unlike the back gesture, which keeps the previous query. The screen
 * below cannot receive params through router.back(), so the word page calls
 * `requestSearchReset` right before navigating back and the search page
 * reacts through `onSearchReset`. Only one search screen lives in a stack at
 * a time, so a single listener slot is enough.
 */

let notify: (() => void) | null = null;

export function requestSearchReset(): void {
  notify?.();
}

export function onSearchReset(fn: () => void): () => void {
  notify = fn;
  return () => {
    if (notify === fn) notify = null;
  };
}

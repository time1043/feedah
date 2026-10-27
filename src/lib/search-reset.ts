type Listener = () => void

let listener: Listener | null = null

/**
 * Signals the search screen to clear its input and refocus — used when the
 * word browser opened from a search result hands control back ("back to
 * search"). Module-level single listener: at most one search screen is alive.
 */
export function requestSearchReset(): void {
  listener?.()
}

export function onSearchReset(fn: Listener): () => void {
  listener = fn
  return () => {
    if (listener === fn) listener = null
  }
}

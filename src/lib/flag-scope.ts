/**
 * Flag attribution rules. A flag belongs to the flag list of the round
 * context the user entered from; only surfaces without a round context
 * (home search, the words tab, day review) fall back to the bucket's
 * current round at write time. Rounds keep independent lists, so the same
 * word can be flagged in one round and not in another.
 */

/** Parses a route param into a round number; anything else is no context. */
export function parseRoundParam(value: unknown): number | undefined {
  const n = typeof value === 'string' ? Number(value) : NaN;
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

/** The round a flag write targets: the context round when the user entered
 * from one, otherwise the bucket's current round at write time. */
export function resolveFlagRound(
  contextRound: number | undefined,
  currentRound: number,
): number {
  return contextRound !== undefined ? contextRound : currentRound;
}

/**
 * The round context a search result carries onto the word page. Round
 * numbers are per-bucket, so a context from book X must never attach to a
 * result from book Y — cross-bucket results fall back to the current round.
 */
export function forwardRoundParam(
  ctxBucketId: string | undefined,
  contextRound: number | undefined,
  resultBucketId: string,
): number | undefined {
  if (contextRound === undefined) return undefined;
  return ctxBucketId !== undefined && ctxBucketId === resultBucketId
    ? contextRound
    : undefined;
}

/**
 * Whether the bookmark toggle must stay disabled: unflagging a past round
 * cannot survive sync (per-round history is append-only in the cloud), so
 * historical flag lists are add-only. The current round — and every surface
 * without a round context — keeps the full toggle.
 */
export function isUnflagLocked(
  contextRound: number | undefined,
  currentRound: number,
  roundFlagged: boolean,
): boolean {
  return contextRound !== undefined && contextRound !== currentRound && roundFlagged;
}

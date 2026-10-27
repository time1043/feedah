import type { Word } from '@/types/word'

export interface SearchOptions {
  /** Also match the Chinese meaning. On by default. */
  matchMeaning?: boolean
}

/**
 * Translates user input into a LIKE-style pattern, matching SQL semantics:
 *   %  any run of zero or more characters
 *   _  exactly one character
 *   \x the literal character x (so \% matches a percent sign)
 * Only % and _ are wildcards; any other character is literal. A query with no
 * wildcard characters is wrapped as a contains-match (%query%), so a plain
 * word search still finds substrings. Examples: `ter%` matches words starting
 * with ter, `%ter` ending with ter, `wo%rd` starting with wo and ending with
 * rd.
 */
export function toLikePattern(query: string): string {
  let out = ''
  let hasWildcard = false
  for (const ch of query) {
    if (ch === '%' || ch === '_') {
      out += ch
      hasWildcard = true
    } else {
      out += ch
    }
  }
  return hasWildcard ? out : `%${out}%`
}

function escapeRegex(ch: string): string {
  return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Compiles a LIKE pattern into a case-insensitive matcher. */
function likeMatcher(pattern: string, contains: boolean): RegExp {
  let source = contains ? '[\\s\\S]*' : '^'
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]
    if (ch === '%') source += '[\\s\\S]*'
    else if (ch === '_') source += '[\\s\\S]'
    else if (ch === '\\') {
      i += 1
      source += escapeRegex(pattern[i] ?? '\\')
    } else source += escapeRegex(ch)
  }
  return new RegExp(`${source}${contains ? '[\\s\\S]*' : ''}$`, 'i')
}

function likeMatches(text: string, pattern: string, contains: boolean): boolean {
  return likeMatcher(pattern, contains).test(text)
}

function wordMatches(word: Word, pattern: string, matchMeaning: boolean): boolean {
  // The headword keeps full SQL LIKE semantics: a wildcard-free query is a
  // contains-match, a pattern with wildcards is anchored (`ter%` matches
  // words starting with ter).
  const hasWildcard = pattern.includes('%') || pattern.includes('_')
  if (likeMatches(word.word, pattern, !hasWildcard)) return true
  // Forms are matched on their word part (the POS suffix stripped), with the
  // same semantics: a query may name any inflected form ("donate") and the
  // hit is the headword that owns it ("donation").
  for (const form of word.forms) {
    const formWord = form.trim().split(/\s+/)[0] ?? ''
    if (formWord.length > 0 && likeMatches(formWord, pattern, !hasWildcard)) return true
  }
  // Meanings are free text starting with a POS tag, so they always match as
  // substrings.
  if (matchMeaning && likeMatches(word.meaning, pattern, true)) return true
  return false
}

/**
 * Filters one bucket's words against a query. `|` splits the query into
 * alternatives whose results are unioned in position order, so two similar
 * words that a single pattern cannot describe can be looked up at once
 * (`scene|sense`, `sc_ne|s_nse`). Each alternative keeps the %/_ rules above,
 * and Chinese queries match the meaning directly.
 */
export function searchWords(words: Word[], query: string, options: SearchOptions = {}): Word[] {
  const matchMeaning = options.matchMeaning ?? true
  const alternatives = query
    .split('|')
    .map((part) => part.trim())
    .filter((part) => part !== '')
  if (alternatives.length === 0) return []

  const patterns = alternatives.map(toLikePattern)
  return words.filter((word) => patterns.some((pattern) => wordMatches(word, pattern, matchMeaning)))
}

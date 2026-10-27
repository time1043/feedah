import { searchWords, toLikePattern } from '@/lib/search'
import type { Word } from '@/types/word'

const words: Word[] = [
  {
    position: 1,
    word: 'for',
    ipa: '',
    meaning: 'prep. 为了……、对于……、conj. 因为',
    forms: [],
  },
  {
    position: 2,
    word: 'change',
    ipa: '',
    meaning: 'v. n. 改变、n. 零钱',
    forms: ['changed v.', 'unchanged adj.', 'changes v. n.', 'changing v.', 'changeable adj.'],
  },
  { position: 3, word: 'take', ipa: '', meaning: 'v. 拿走、携带', forms: ['took v.', 'taken v.'] },
  {
    position: 4,
    word: 'interest',
    ipa: '',
    meaning: 'n. 兴趣、利益',
    forms: ['interested adj.', 'interesting v. adj.'],
  },
  { position: 5, word: '100%', ipa: '', meaning: '百分之一百', forms: [] },
]

describe('toLikePattern', () => {
  it('wraps wildcard-free queries as contains-matches', () => {
    expect(toLikePattern('ter')).toBe('%ter%')
  })

  it('keeps explicit wildcards verbatim', () => {
    expect(toLikePattern('ter%')).toBe('ter%')
    expect(toLikePattern('%ter')).toBe('%ter')
    expect(toLikePattern('wo%rd')).toBe('wo%rd')
    expect(toLikePattern('w_ter')).toBe('w_ter')
  })
})

describe('searchWords', () => {
  it('finds substrings case-insensitively', () => {
    expect(searchWords(words, 'ter').map((word) => word.word)).toEqual(['interest'])
    expect(searchWords(words, 'TER').map((word) => word.word)).toEqual(['interest'])
    expect(searchWords(words, 'cha').map((word) => word.word)).toEqual(['change'])
  })

  it('honors prefix, suffix and infix wildcards', () => {
    expect(searchWords(words, 'cha%').map((word) => word.word)).toEqual(['change'])
    expect(searchWords(words, '%nge').map((word) => word.word)).toEqual(['change'])
    expect(searchWords(words, 'c%ge').map((word) => word.word)).toEqual(['change'])
    expect(searchWords(words, 'cha_').map((word) => word.word)).toEqual([])
    expect(searchWords(words, 'for_').map((word) => word.word)).toEqual([])
  })

  it('matches inflected forms and returns the headword', () => {
    expect(searchWords(words, 'donate')).toEqual([])
    expect(searchWords(words, 'taken').map((word) => word.word)).toEqual(['take'])
    expect(searchWords(words, 'interested').map((word) => word.word)).toEqual(['interest'])
    expect(searchWords(words, 'changeable').map((word) => word.word)).toEqual(['change'])
  })

  it('matches Chinese meanings', () => {
    expect(searchWords(words, '零钱').map((word) => word.word)).toEqual(['change'])
    expect(searchWords(words, '因为').map((word) => word.word)).toEqual(['for'])
    expect(searchWords(words, '兴趣').map((word) => word.word)).toEqual(['interest'])
  })

  it('treats % and _ as wildcards inside forms and meanings too', () => {
    expect(searchWords(words, 'chan_ing').map((word) => word.word)).toEqual(['change'])
    expect(searchWords(words, '改%').map((word) => word.word)).toEqual(['change'])
  })

  it('can escape a wildcard to match it literally', () => {
    expect(searchWords(words, '100\\%').map((word) => word.word)).toEqual(['100%'])
    expect(searchWords(words, '100%').map((word) => word.word)).toEqual(['100%'])
  })

  it('unions alternatives across the pipe', () => {
    expect(searchWords(words, 'take|零钱').map((word) => word.position)).toEqual([2, 3])
    expect(searchWords(words, '  take |  interest  ').map((word) => word.position)).toEqual([3, 4])
  })

  it('matches nothing for an empty query', () => {
    expect(searchWords(words, '')).toEqual([])
    expect(searchWords(words, '   ')).toEqual([])
    expect(searchWords(words, '|')).toEqual([])
  })

  it('keeps results in bucket order', () => {
    expect(searchWords(words, 'a').map((word) => word.position)).toEqual([2, 3, 4])
  })
})

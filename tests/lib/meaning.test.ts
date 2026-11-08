import { meaningLines } from '@/lib/meaning'

describe('meaningLines', () => {
  it('keeps short meanings on one line', () => {
    expect(meaningLines('v. 拿走、携带')).toBeNull()
    expect(meaningLines('n. 蚂蚁')).toBeNull()
    expect(meaningLines('')).toBeNull()
  })

  it('keeps single-POS groups on one line', () => {
    expect(meaningLines('n. 形式、表格、外观')).toBeNull()
  })

  it('breaks a long meaning into one line per POS group', () => {
    expect(meaningLines('prep. 为了……、对于……、conj. 因为')).toEqual([
      'prep. 为了……、对于……',
      'conj. 因为',
    ])
  })

  it('joins bare senses into the line they follow', () => {
    expect(meaningLines('v. 改变、n. 零钱、变化')).toEqual(['v. 改变', 'n. 零钱、变化'])
  })

  it('trims whitespace around senses and rejoins with bare 、', () => {
    expect(meaningLines('v. a 、 b 、 c 、 d. e')).toEqual(['v. a、b、c', 'd. e'])
  })
})

// Cases lifted verbatim from the real bucket
// (vocabulary-bucket/data/free-nmet/2050.json) — one per shape the card can
// meet in production.
describe('meaningLines against the real 2050 senses', () => {
  it('for: prep. group then conj. group', () => {
    expect(meaningLines('prep. 为了……、对于……、conj. 因为')).toEqual([
      'prep. 为了……、对于……',
      'conj. 因为',
    ])
  })

  it('work: the bare senses stay inside their POS group', () => {
    expect(meaningLines('n. 工作、作品、v. 奏效')).toEqual(['n. 工作、作品', 'v. 奏效'])
  })

  it('live: verb group then adjective group', () => {
    expect(meaningLines('v. 居住、生活、adj. 现场的')).toEqual(['v. 居住、生活', 'adj. 现场的'])
  })

  it('hold: three senses of one verb stay on one line', () => {
    expect(meaningLines('v. 握着、坚持、举办')).toBeNull()
  })

  it('run: three senses of one verb stay on one line', () => {
    expect(meaningLines('v. 跑步、经营、运行')).toBeNull()
  })

  it('since: the bare 既然 joins the conj. line before it', () => {
    expect(meaningLines('prep. 自从、conj. 因为、既然')).toEqual(['prep. 自从', 'conj. 因为、既然'])
  })

  it('in, look, decide: single short senses never break', () => {
    expect(meaningLines('prep. 在……内')).toBeNull()
    expect(meaningLines('v. 看')).toBeNull()
    expect(meaningLines('v. 决定')).toBeNull()
  })
})

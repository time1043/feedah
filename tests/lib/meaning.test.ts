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

import { meaningLines } from '@/lib/meaning';

describe('meaningLines', () => {
  it('groups word meanings by part of speech', () => {
    expect(meaningLines('prep. 为了……、对于……、conj. 因为', 'word')).toEqual([
      'prep. 为了……、对于……',
      'conj. 因为',
    ]);
  });

  it('returns null for short or single-group word meanings', () => {
    expect(meaningLines('n. 改变', 'word')).toBeNull();
    expect(meaningLines('n. 形式、表格、外观', 'word')).toBeNull();
  });

  it('splits qa backs into answer/explanation paragraphs', () => {
    expect(meaningLines('A．选项一\n\n因为……', 'qa')).toEqual(['A．选项一', '因为……']);
  });

  it('returns null for single-paragraph qa backs', () => {
    expect(meaningLines('A．选项一', 'qa')).toBeNull();
  });

  it('defaults to word behavior', () => {
    expect(meaningLines('v. 走、go、n. 步伐')).toEqual(['v. 走、go', 'n. 步伐']);
  });
});

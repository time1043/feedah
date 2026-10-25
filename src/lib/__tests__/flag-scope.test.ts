import {
  forwardRoundParam,
  isUnflagLocked,
  parseRoundParam,
  resolveFlagRound,
} from '@/lib/flag-scope';

describe('parseRoundParam', () => {
  it('accepts positive integer strings', () => {
    expect(parseRoundParam('2')).toBe(2);
    expect(parseRoundParam('12')).toBe(12);
  });

  it('rejects non-rounds and junk', () => {
    expect(parseRoundParam('0')).toBeUndefined();
    expect(parseRoundParam('-1')).toBeUndefined();
    expect(parseRoundParam('2.5')).toBeUndefined();
    expect(parseRoundParam('abc')).toBeUndefined();
    expect(parseRoundParam('')).toBeUndefined();
    expect(parseRoundParam(undefined)).toBeUndefined();
    expect(parseRoundParam(2)).toBeUndefined();
  });
});

describe('resolveFlagRound', () => {
  it('uses the context round when the user entered from one', () => {
    expect(resolveFlagRound(2, 5)).toBe(2);
  });

  it('falls back to the current round without a context (home search)', () => {
    expect(resolveFlagRound(undefined, 5)).toBe(5);
  });
});

describe('forwardRoundParam', () => {
  it('forwards the context round to results of the context bucket', () => {
    expect(forwardRoundParam('2050', 2, '2050')).toBe(2);
  });

  it('drops the context for cross-bucket results — round numbers are per-bucket', () => {
    expect(forwardRoundParam('2050', 2, '700')).toBeUndefined();
  });

  it('drops everything without a context', () => {
    expect(forwardRoundParam(undefined, 2, '2050')).toBeUndefined();
    expect(forwardRoundParam('2050', undefined, '2050')).toBeUndefined();
  });
});

describe('isUnflagLocked', () => {
  it('locks the toggle on a word already in a past round’s list', () => {
    expect(isUnflagLocked(1, 5, true)).toBe(true);
  });

  it('allows flagging into a past round (add-only)', () => {
    expect(isUnflagLocked(1, 5, false)).toBe(false);
  });

  it('keeps the full toggle for the current round', () => {
    expect(isUnflagLocked(5, 5, true)).toBe(false);
    expect(isUnflagLocked(5, 5, false)).toBe(false);
  });

  it('keeps the full toggle on fallback surfaces without a round context', () => {
    expect(isUnflagLocked(undefined, 5, true)).toBe(false);
  });
});

// day-jump holds module-level state (published/applied); reset per test.
let dayJump: typeof import('@/lib/day-jump');

beforeEach(() => {
  jest.resetModules();
  dayJump = require('@/lib/day-jump');
});

describe('selected-day publication', () => {
  it('consumes null before anything is published', () => {
    expect(dayJump.consumeSelectedDayChange()).toBeNull();
  });

  it('hands the published day to the next consumer', () => {
    dayJump.publishSelectedDay('2026-10-26');
    expect(dayJump.consumeSelectedDayChange()).toBe('2026-10-26');
  });

  it('is change-detection, not one-shot: the same day is never handed out twice', () => {
    dayJump.publishSelectedDay('2026-10-26');
    expect(dayJump.consumeSelectedDayChange()).toBe('2026-10-26');
    expect(dayJump.consumeSelectedDayChange()).toBeNull();
    dayJump.publishSelectedDay('2026-10-26');
    expect(dayJump.consumeSelectedDayChange()).toBeNull();
  });

  it('re-anchors when the published day changes', () => {
    dayJump.publishSelectedDay('2026-10-26');
    dayJump.consumeSelectedDayChange();
    dayJump.publishSelectedDay('2026-10-27');
    expect(dayJump.consumeSelectedDayChange()).toBe('2026-10-27');
  });
});

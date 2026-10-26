// usage.ts runs real timers against the repo — replace the repo so the flush
// target is observable and expo-sqlite never loads. The module keeps all
// state at module level, so every test gets a fresh copy via resetModules.
jest.mock('@/db/repo', () => ({ addDailyTime: jest.fn() }));

let usage: typeof import('@/db/usage');
let addDailyTime: jest.Mock;

// startAppUsage schedules a self-flushing 10s interval; any test that advances
// the fake clock past a 10s boundary must account for that automatic flush.
const flushMicrotasks = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-26T12:00:00Z'));
  jest.resetModules();
  usage = require('@/db/usage');
  addDailyTime = require('@/db/repo').addDailyTime;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('flushUsage', () => {
  it('does not write anything when nothing was started', async () => {
    await usage.flushUsage();
    expect(addDailyTime).not.toHaveBeenCalled();
  });

  it('records feed seconds on a manual flush', async () => {
    usage.startFeedUsage();
    jest.advanceTimersByTime(12_000);
    await usage.flushUsage();
    expect(addDailyTime).toHaveBeenCalledWith('2026-10-26', 12, 0);
  });

  it('keeps the sub-second remainder across flushes', async () => {
    usage.startFeedUsage();
    jest.advanceTimersByTime(10_500);
    await usage.flushUsage();
    expect(addDailyTime).toHaveBeenCalledWith('2026-10-26', 10, 0);
    jest.advanceTimersByTime(500);
    await usage.flushUsage();
    expect(addDailyTime).toHaveBeenCalledWith('2026-10-26', 1, 0);
    expect(addDailyTime).toHaveBeenCalledTimes(2);
  });

  it('does not write a flush that rounds to zero seconds', async () => {
    usage.startAppUsage();
    jest.advanceTimersByTime(999);
    await usage.flushUsage();
    expect(addDailyTime).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    await usage.flushUsage();
    expect(addDailyTime).toHaveBeenCalledWith('2026-10-26', 0, 1);
  });

  it('stops accumulating after pause', async () => {
    usage.startAppUsage();
    jest.advanceTimersByTime(5_000);
    usage.pauseAppUsage();
    jest.advanceTimersByTime(10_000);
    await usage.flushUsage();
    expect(addDailyTime).toHaveBeenCalledWith('2026-10-26', 0, 5);
  });

  it('drops concurrent flushes while one is in flight', async () => {
    usage.startFeedUsage();
    jest.advanceTimersByTime(10_000);
    let release: () => void = () => {};
    addDailyTime.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const first = usage.flushUsage();
    await usage.flushUsage();
    release();
    await first;
    expect(addDailyTime).toHaveBeenCalledTimes(1);
  });
});

describe('startAppUsage', () => {
  it('starts exactly one self-flushing interval', async () => {
    usage.startAppUsage();
    usage.startAppUsage();
    expect(jest.getTimerCount()).toBe(1);
    jest.advanceTimersByTime(10_000);
    await flushMicrotasks();
    expect(addDailyTime).toHaveBeenCalledTimes(1);
    expect(addDailyTime).toHaveBeenCalledWith('2026-10-26', 0, 10);
  });
});

describe('getLiveUsage', () => {
  it('tracks feed and app sessions independently', () => {
    usage.startAppUsage();
    jest.advanceTimersByTime(3_000);
    usage.startFeedUsage();
    jest.advanceTimersByTime(2_000);
    expect(usage.getLiveUsage()).toEqual({ appMs: 5_000, feedMs: 2_000 });
  });

  it('reports unflushed time after a flush', () => {
    usage.startFeedUsage();
    jest.advanceTimersByTime(10_500);
    expect(usage.getLiveUsage()).toEqual({ appMs: 0, feedMs: 10_500 });
  });
});

describe('resetUsage', () => {
  it('drops pending time but keeps the running session', async () => {
    usage.startAppUsage();
    jest.advanceTimersByTime(5_000);
    usage.resetUsage();
    jest.advanceTimersByTime(1_000);
    await usage.flushUsage();
    // startedAt was not reset, so the flush accounts the whole session
    expect(addDailyTime).toHaveBeenCalledWith('2026-10-26', 0, 6);
  });
});

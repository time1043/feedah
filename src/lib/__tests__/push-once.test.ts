// push-once holds module-level state (lastAt); reset the module per test.
let pushOnce: typeof import('@/lib/push-once')['pushOnce'];

beforeEach(() => {
  jest.useFakeTimers();
  jest.resetModules();
  pushOnce = require('@/lib/push-once').pushOnce;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('pushOnce', () => {
  it('pushes the first press', () => {
    const push = jest.fn();
    pushOnce(push);
    expect(push).toHaveBeenCalledTimes(1);
  });

  it('swallows presses inside the 800ms window', () => {
    const push = jest.fn();
    pushOnce(push);
    jest.advanceTimersByTime(100);
    pushOnce(push);
    jest.advanceTimersByTime(699);
    pushOnce(push);
    expect(push).toHaveBeenCalledTimes(1);
  });

  it('lets a press through once the window has closed', () => {
    const push = jest.fn();
    pushOnce(push);
    jest.advanceTimersByTime(800);
    pushOnce(push);
    expect(push).toHaveBeenCalledTimes(2);
  });

  it('restarts the window after each accepted press', () => {
    const push = jest.fn();
    pushOnce(push);
    jest.advanceTimersByTime(800);
    pushOnce(push);
    jest.advanceTimersByTime(100);
    pushOnce(push);
    expect(push).toHaveBeenCalledTimes(2);
  });
});

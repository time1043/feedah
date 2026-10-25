// search-reset holds module-level state (single listener slot); reset per test.
let searchReset: typeof import('@/lib/search-reset');

beforeEach(() => {
  jest.resetModules();
  searchReset = require('@/lib/search-reset');
});

describe('search reset signal', () => {
  it('does nothing without a listener', () => {
    expect(() => searchReset.requestSearchReset()).not.toThrow();
  });

  it('notifies the registered listener', () => {
    const fn = jest.fn();
    searchReset.onSearchReset(fn);
    searchReset.requestSearchReset();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('stops notifying after unsubscribe', () => {
    const fn = jest.fn();
    const unsubscribe = searchReset.onSearchReset(fn);
    unsubscribe();
    searchReset.requestSearchReset();
    expect(fn).not.toHaveBeenCalled();
  });

  it('holds a single listener slot: a newer registration replaces the older', () => {
    const first = jest.fn();
    const second = jest.fn();
    searchReset.onSearchReset(first);
    searchReset.onSearchReset(second);
    searchReset.requestSearchReset();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('ignores a stale unsubscribe from a replaced listener', () => {
    const second = jest.fn();
    const unsubscribeFirst = searchReset.onSearchReset(jest.fn());
    searchReset.onSearchReset(second);
    unsubscribeFirst();
    searchReset.requestSearchReset();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('unsubscribing twice is harmless', () => {
    const unsubscribe = searchReset.onSearchReset(jest.fn());
    unsubscribe();
    expect(() => unsubscribe()).not.toThrow();
  });
});

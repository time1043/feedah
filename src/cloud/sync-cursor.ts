import * as SecureStore from 'expo-secure-store';

// Per-install sync watermarks. Kept in the device keychain — NOT the synced
// `meta` table — so they never travel to the cloud and can never re-trigger a
// sync loop. They are monotonic:
//   pullCursor  = `pulledAt` of the last successful pull; pull asks for changes
//                 made after it.
//   pushCursor  = `pushedAt` of the last successful push; the snapshot only
//                 ships rows newer than it.
// A value of 0 (absent) means "never synced" → the next cycle runs a full
// bootstrap. Losing the cursors (e.g. app reinstall) is harmless: the cycle
// falls back to 0, does one full sync, and re-establishes the watermarks — the
// merge rules are idempotent, so a duplicate full sync converges.

const PUSH_KEY = 'feedah.sync.pushCursor';
const PULL_KEY = 'feedah.sync.pullCursor';

async function read(key: string): Promise<number> {
  const raw = await SecureStore.getItemAsync(key);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

export const getPushCursor = () => read(PUSH_KEY);
export const getPullCursor = () => read(PULL_KEY);
export const setPushCursor = (n: number) => SecureStore.setItemAsync(PUSH_KEY, String(n));
export const setPullCursor = (n: number) => SecureStore.setItemAsync(PULL_KEY, String(n));
export const clearCursors = () =>
  Promise.all([SecureStore.deleteItemAsync(PUSH_KEY), SecureStore.deleteItemAsync(PULL_KEY)]);

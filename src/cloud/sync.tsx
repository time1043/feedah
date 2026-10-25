import { useConvexAuth } from '@convex-dev/auth/react';
import NetInfo from '@react-native-community/netinfo';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { useSettings } from '@/db/settings';

// The convex/ directory sits at the repo root, outside the @/* (src) mapping.
import { api } from '../../convex/_generated/api';
import { CONVEX_URL, convex } from './convex';
import { applyCloudState } from './mirror';
import { readLocalSnapshot } from './snapshot';
import { getPullCursor, getPushCursor, setPullCursor, setPushCursor } from './sync-cursor';

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

type SyncContextValue = {
  status: SyncStatus;
  lastSyncedAt: number | null;
  lastError: string | null;
  /** Bumps after every successful sync so screens can re-read. */
  version: number;
  syncNow: () => void;
};

const SyncContext = createContext<SyncContextValue | null>(null);

// Module-level mutex: a sync must not run concurrently with itself, whichever
// trigger fired first. It is set synchronously before any await — foregrounding
// raises AppState and a NetInfo re-check in the same tick, and a mutex set
// after an await would let both run full cycles concurrently. A trigger that
// arrives mid-run registers one follow-up pass instead of racing.
let syncing = false;
let pendingSync = false;

// Foreground / network-regain syncs are deferred by this much so the first
// taps after returning to the app are not queued behind the sync burst on the
// JS thread. Manual `syncNow` and the auth-ready trigger stay immediate.
const RESUME_SYNC_DELAY_MS = 1500;

/**
 * Cloud sync engine. Runs only when a deployment URL is configured and a
 * real account is bound; guests are pure local — an anonymous identity is
 * device-bound and unclaimable, so mirroring its rows buys no cross-device
 * value, only orphaned data and a resurrect-after-clear hazard.
 *
 * One sync = pull (merge cloud rows into SQLite) then push (send the local
 * state; the server merges). Triggers: the bound account becoming ready, and
 * network regain / app foreground while bound. Offline the app keeps working
 * untouched and the next trigger catches up.
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { settings, ready: settingsReady, reload } = useSettings();
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  // Callbacks sample auth state through a ref so triggers registered once can
  // always see the current value without re-subscribing.
  const authedRef = useRef(false);
  useEffect(() => {
    authedRef.current = isAuthenticated;
  }, [isAuthenticated]);
  const boundRef = useRef(false);
  useEffect(() => {
    boundRef.current = settingsReady && !!settings.accountEmail;
  }, [settingsReady, settings.accountEmail]);

  const runSyncRef = useRef<() => void>(() => {});
  const runSync = useCallback(async () => {
    if (syncing) {
      pendingSync = true;
      return;
    }
    if (!convex || !authedRef.current || !boundRef.current) return;
    syncing = true;
    try {
      // Pull only what changed after the last successful pull, then push only
      // what changed after the last successful push. Each side's watermark is
      // advanced to the timestamp the server stamped on its response. A 0
      // watermark (first sync) yields a full bootstrap; the merge rules are
      // idempotent so a duplicate full sync converges.
      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        setStatus('offline');
        return;
      }
      setStatus('syncing');
      const pullCursor = await getPullCursor();
      const cloud = await convex.query(api.sync.pull, { since: pullCursor });
      const { metaChanged } = await applyCloudState(cloud);
      // Advance the pull cursor as soon as the pull is merged, independent of
      // the push: if the push fails, its snapshot is re-sent next cycle
      // (idempotent server merge), but leaving the pull cursor stale would
      // re-pull and re-run the whole merge on every foreground.
      await setPullCursor(cloud.pulledAt);
      const pushCursor = await getPushCursor();
      const snapshot = await readLocalSnapshot(pushCursor);
      const { pushedAt } = await convex.mutation(api.sync.push, snapshot);
      await setPushCursor(pushedAt);
      if (metaChanged) await reload();
      setLastSyncedAt(Date.now());
      setLastError(null);
      setStatus('idle');
      setVersion((v) => v + 1);
    } catch (error) {
      setLastError(error instanceof Error ? error.message : String(error));
      setStatus('error');
    } finally {
      syncing = false;
      if (pendingSync) {
        pendingSync = false;
        void runSyncRef.current();
      }
    }
  }, [reload]);

  // Triggers sample the callback through a ref: `reload` gets a fresh identity
  // on every settings render, and the triggers must not re-arm each time.
  useEffect(() => {
    runSyncRef.current = runSync;
  }, [runSync]);
  const trigger = useCallback(() => {
    void runSyncRef.current();
  }, []);

  // The first sync of a session fires once the bound account is known — auth
  // may resolve before or after settings load, so both edges are triggers.
  useEffect(() => {
    if (isLoading || !isAuthenticated || !settingsReady || !settings.accountEmail) return;
    trigger();
  }, [isLoading, isAuthenticated, settingsReady, settings.accountEmail, trigger]);

  // Network regain and app foreground both trigger a catch-up sync, deferred
  // by RESUME_SYNC_DELAY_MS so the first taps after returning to the app are
  // not queued behind the sync burst. Deferring also coalesces the
  // near-simultaneous AppState and NetInfo fires on foreground into one run.
  useEffect(() => {
    if (!CONVEX_URL) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(trigger, RESUME_SYNC_DELAY_MS);
    };
    const unsubNet = NetInfo.addEventListener((state) => {
      if (state.isConnected) schedule();
    });
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') schedule();
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubNet();
      appSub.remove();
    };
  }, [trigger]);

  const syncNow = trigger;

  return (
    <SyncContext.Provider value={{ status, lastSyncedAt, lastError, version, syncNow }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncContextValue {
  const context = useContext(SyncContext);
  if (!context) throw new Error('useSync must be used within SyncProvider');
  return context;
}

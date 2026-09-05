import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuthActions, useConvexAuth } from '@convex-dev/auth/react';
import { anyApi } from 'convex/server';
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';

import { useSettings } from '@/db/settings';

import { CONVEX_URL, convex } from './convex';
import { applyCloudState } from './mirror';
import { readLocalSnapshot } from './snapshot';

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
// trigger fired first.
let syncing = false;

/**
 * Cloud sync engine. Runs only when a deployment URL is configured; otherwise
 * the provider is not mounted at all and the app stays purely local.
 *
 * One sync = pull (merge cloud rows into SQLite) then push (send the local
 * state; the server merges). Triggers: app start after auth resolves, network
 * regain, and app foreground. Offline the app keeps working untouched and the
 * next trigger catches up.
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  const { reload } = useSettings();
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

  const runSync = useCallback(async () => {
    if (syncing || !convex || !authedRef.current) return;
    const net = await NetInfo.fetch();
    if (!net.isConnected) {
      setStatus('offline');
      return;
    }
    syncing = true;
    setStatus('syncing');
    try {
      const cloud = await convex.query(anyApi.sync.pull, {});
      const { metaChanged } = await applyCloudState(cloud);
      const snapshot = await readLocalSnapshot();
      await convex.mutation(anyApi.sync.push, snapshot);
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
    }
  }, [reload]);

  // Anonymous identity keeps the app account-less while still giving cloud
  // rows an owner. Offline it fails quietly and is retried by the triggers.
  useEffect(() => {
    if (!isLoading && !isAuthenticated && CONVEX_URL) {
      signIn('Anonymous').catch(() => {});
    }
  }, [isLoading, isAuthenticated, signIn]);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    void runSync();
  }, [isLoading, isAuthenticated, runSync]);

  // Network regain and app foreground both trigger a catch-up sync.
  useEffect(() => {
    if (!CONVEX_URL) return;
    const unsubNet = NetInfo.addEventListener((state) => {
      if (state.isConnected) void runSync();
    });
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void runSync();
    });
    return () => {
      unsubNet();
      appSub.remove();
    };
  }, [runSync]);

  const syncNow = useCallback(() => {
    void runSync();
  }, [runSync]);

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

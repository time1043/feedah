import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { getDb } from './index';

export type ThemeMode = 'system' | 'light' | 'dark';
export type SpeechRate = 'slow' | 'normal' | 'fast';

export type Settings = {
  activeBucketId: string;
  theme: ThemeMode;
  autoPronounce: boolean;
  speechRate: SpeechRate;
  progressBar: boolean;
  progressBarDrag: boolean;
  feedSearch: boolean;
  todayReadout: boolean;
  silentHintShown: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  activeBucketId: '2050',
  theme: 'system',
  autoPronounce: true,
  speechRate: 'normal',
  progressBar: true,
  progressBarDrag: true,
  feedSearch: true,
  todayReadout: true,
  silentHintShown: false,
};

/** Speech rate multiplier for expo-speech, 1.0 is the system default. */
export const SPEECH_RATE_VALUE: Record<SpeechRate, number> = {
  slow: 0.9,
  normal: 1.15,
  fast: 1.4,
};

type SettingsContextValue = {
  settings: Settings;
  ready: boolean;
  update: (partial: Partial<Settings>) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

async function loadSettings(): Promise<Partial<Settings>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM meta');
  const stored: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      stored[row.key] = JSON.parse(row.value);
    } catch {
      stored[row.key] = row.value;
    }
  }
  const merged: Partial<Settings> = {};
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    if (key in stored) {
      (merged as Record<string, unknown>)[key] = stored[key];
    }
  }
  return merged;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadSettings()
      .then((stored) => {
        if (!cancelled) {
          setSettings((prev) => ({ ...prev, ...stored }));
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (partial: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
    void (async () => {
      const db = await getDb();
      for (const [key, value] of Object.entries(partial)) {
        await db.runAsync(
          'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
          [key, JSON.stringify(value)],
        );
      }
    })();
  };

  return (
    <SettingsContext.Provider value={{ settings, ready, update }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
}

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { getDb } from './index';
import { meta } from './schema';

export type ThemeMode = 'system' | 'light' | 'dark';
export type SpeechRate = 'slow' | 'normal' | 'fast';

/** How cards treat the meaning: hidden until tapped, shown until tapped, or always shown. */
export type MeaningMode = 'hidden' | 'shown' | 'always';

/** One user-configurable reminder. */
export type Reminder = {
  id: string;
  label: string;
  /** "HH:MM" in 24-hour form. */
  time: string;
  enabled: boolean;
};

export type Settings = {
  activeBucketId: string;
  theme: ThemeMode;
  autoPronounce: boolean;
  speechRate: SpeechRate;
  meaningMode: MeaningMode;
  progressBar: boolean;
  progressBarDrag: boolean;
  wordProgressBar: boolean;
  feedSearch: boolean;
  todayReadout: boolean;
  silentHintShown: boolean;
  remindersEnabled: boolean;
  reminders: Reminder[];
  /** Bound email after the optional Password upgrade; '' means anonymous. */
  accountEmail: string;
};

export const DEFAULT_SETTINGS: Settings = {
  activeBucketId: '2050',
  theme: 'system',
  autoPronounce: true,
  speechRate: 'normal',
  meaningMode: 'hidden',
  progressBar: false,
  progressBarDrag: true,
  wordProgressBar: true,
  feedSearch: true,
  todayReadout: true,
  silentHintShown: false,
    remindersEnabled: false,
    reminders: [
      { id: 'breakfast', label: 'Breakfast', time: '08:30', enabled: true },
      { id: 'lunch', label: 'Lunch', time: '12:30', enabled: true },
      { id: 'dinner', label: 'Dinner', time: '18:30', enabled: true },
    ],
    accountEmail: '',
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
  /** Re-reads settings from the database (after a full data wipe). */
  reload: () => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

async function loadSettings(): Promise<Partial<Settings>> {
  const db = await getDb();
  const rows = await db.select().from(meta);
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
  // Array settings must keep their shape, whatever is in the database.
  if (!isValidReminders(merged.reminders)) {
    // Migrate the previous fixed-meal settings (mealTimes / mealEnabled).
    const times = stored.mealTimes;
    const enabled = stored.mealEnabled;
    const names = ['Breakfast', 'Lunch', 'Dinner'];
    if (
      Array.isArray(times) &&
      Array.isArray(enabled) &&
      times.length > 0 &&
      times.length === enabled.length
    ) {
      merged.reminders = times.map((time, index) => ({
        id: `meal-${index}`,
        label: names[index] ?? `Reminder ${index + 1}`,
        time: typeof time === 'string' ? time : '08:30',
        enabled: enabled[index] === true,
      }));
    } else {
      merged.reminders = DEFAULT_SETTINGS.reminders;
    }
  }
  return merged;
}

function isValidReminders(value: unknown): value is Reminder[] {
  return (
    Array.isArray(value) &&
    value.every(
      (reminder): reminder is Reminder =>
        !!reminder &&
        typeof reminder === 'object' &&
        typeof reminder.id === 'string' &&
        typeof reminder.label === 'string' &&
        typeof reminder.time === 'string' &&
        typeof reminder.enabled === 'boolean',
    )
  );
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
      const now = Date.now();
      for (const [key, value] of Object.entries(partial)) {
        await db
          .insert(meta)
          .values({ key, value: JSON.stringify(value), updatedAt: now })
          .onConflictDoUpdate({
            target: meta.key,
            set: { value: JSON.stringify(value), updatedAt: now },
          });
      }
    })();
  };

  const reload = async () => {
    setSettings(DEFAULT_SETTINGS);
    try {
      const stored = await loadSettings();
      setSettings({ ...DEFAULT_SETTINGS, ...stored });
    } catch {
      setSettings(DEFAULT_SETTINGS);
    }
    setReady(true);
  };

  return (
    <SettingsContext.Provider value={{ settings, ready, update, reload }}>
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

import { useDrizzleStudio } from 'expo-drizzle-studio-plugin';
import { useEffect, useState } from 'react';
import * as SQLite from 'expo-sqlite';

import { getDb, getRawDb } from './index';

/**
 * Bridges the app database into Drizzle Studio. Render in __DEV__ only; with
 * a dev build running, press shift+m in the Expo CLI terminal and pick this
 * plugin to browse the on-device data in a browser.
 */
export function DrizzleStudio() {
  const [raw, setRaw] = useState<SQLite.SQLiteDatabase | null>(null);
  useEffect(() => {
    let active = true;
    void getDb().then(() => {
      if (active) setRaw(getRawDb());
    });
    return () => {
      active = false;
    };
  }, []);
  useDrizzleStudio(raw);
  return null;
}

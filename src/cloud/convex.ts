import { ConvexReactClient } from 'convex/react';

// The deployment URL comes from .env.local (EXPO_PUBLIC_CONVEX_URL) and is
// baked into builds by EAS. When unset the app is fully local: no cloud
// provider is mounted and sync is disabled.
export const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL ?? '';

export const convex = CONVEX_URL
  ? new ConvexReactClient(CONVEX_URL, { unsavedChangesWarning: false })
  : null;

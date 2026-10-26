import type { BucketKind } from '@/db/schema';

import type { ModePlugin } from './types';

import { choiceMode } from './choice';
import { flipMode } from './flip';

export type { ModeCardProps, ModePlugin, ModeResult } from './types';

// Static module list: Metro cannot resolve dynamic requires, and a
// statically analyzable list keeps imports and tree-shaking honest. Order is
// the fallback order — flip first, it supports every bucket kind.
export const MODES: ModePlugin[] = [flipMode, choiceMode];

/** Resolves a stored mode id to a plugin that supports the bucket kind. */
export function getMode(id: string, kind: BucketKind): ModePlugin {
  const supporting = (plugin: ModePlugin) => plugin.supports?.(kind) ?? true;
  return (
    MODES.find((plugin) => plugin.id === id && supporting(plugin)) ??
    MODES.find(supporting) ??
    MODES[0]
  );
}

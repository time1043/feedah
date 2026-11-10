import type { Drill } from './contract'

import quiz from './quiz'
import swipe from './swipe'
import typeDrill from './type'

/**
 * The drill registry: the core app's only point of contact with concrete
 * drills. Screens, settings and the session layer read from here — they
 * must never import a drill module directly.
 *
 * Adding a drill: create a self-contained module in src/drills/ that
 * exports a Drill as its default (the contract is ./contract.ts, the
 * guide is src/drills/README.md), then add it to the manifest below.
 * Nothing else in the core changes.
 */
const MANIFEST: Drill[] = [
  swipe,
  quiz,
  typeDrill, // ← new plugins join here
]

const drills: Drill[] = []
for (const drill of MANIFEST) {
  registerDrill(drill)
}

/** Registers a drill; refuses a second drill under the same id. */
export function registerDrill(drill: Drill): void {
  if (drills.some((known) => known.id === drill.id)) {
    throw new Error(`A drill with id "${drill.id}" is already registered`)
  }
  drills.push(drill)
}

/** Every registered drill, in manifest order — the settings chips' order. */
export function getDrills(): Drill[] {
  return [...drills]
}

/** Looks a drill up by id; unknown ids (e.g. legacy stored values) fall
 * back to swipe, which records nothing and so is always safe. */
export function getDrill(id: string): Drill {
  return drills.find((drill) => drill.id === id) ?? swipe
}

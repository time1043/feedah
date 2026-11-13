/** The app's single accent green — the leaf's lime. Fill surfaces (buttons,
 * chips, bars) are the lime itself with black text in both themes; text and
 * icons sitting on the page background use the lime on dark and a deepened
 * olive on light, where the lime would wash out. Matches tailwind's
 * accent / accent-deep in tailwind.config.js so className and constant agree. */
export const ACCENT = { light: '#55741E', dark: '#C5F36A' } as const

/** The leaf's lime itself — the brand fill, always under black content.
 * Also the caret color: a lime cursor inside the fields that wear the ring. */
export const LIME = '#C5F36A'

/** The flag's red — the card's bookmark once set, the word list's mark, and a
 * flagged column of a round's sweep (hence the dark variant). */
export const FLAG_RED = { light: '#E5484D', dark: '#F0666B' } as const

/** Adds an alpha channel to #RRGGBB — the heatmap's color levels. */
export function withAlpha(hex: string, alpha: number): string {
  return `${hex}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0')}`
}

/** The app's single accent blue — buttons, active icons, selection marks.
 * Matches tailwind's blue-500 so className and constant agree. */
export const ACCENT = '#3B82F6'

/** The flag's red — the card's bookmark once set, the word list's mark, and a
 * flagged column of a round's sweep (hence the dark variant). */
export const FLAG_RED = { light: '#E5484D', dark: '#F0666B' } as const

/** Adds an alpha channel to #RRGGBB — the heatmap's color levels. */
export function withAlpha(hex: string, alpha: number): string {
  return `${hex}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0')}`
}

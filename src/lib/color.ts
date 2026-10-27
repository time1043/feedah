/** #RRGGBB -> #RRGGBBXX, alpha in 0..1, for layered fills over a surface. */
export function withAlpha(color: string, alpha: number): string {
  const value = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0')
  return `${color}${value}`
}

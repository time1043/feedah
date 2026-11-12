/** Formats seconds as "47m" or "1h 12m". */
export function formatMinutes(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60)
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Formats a YYYY-MM-DD day as a short label like "Wed, Sep 3". */
export function formatDayLabel(day: string): string {
  const [year, month, date] = day.split('-').map(Number)
  if (!year || !month || !date) return day
  // Build a local date from parts to avoid UTC shift from `new Date(iso)`.
  const weekday = WEEKDAYS[new Date(year, month - 1, date).getDay()]
  return `${weekday}, ${MONTHS[month - 1]} ${date}`
}

/** Formats a YYYY-MM-DD day or epoch millisecond timestamp as "2026 Oct 7". */
export function formatYearMonthDay(dayOrTimestamp: string | number): string {
  let year: number
  let month: number
  let date: number
  if (typeof dayOrTimestamp === 'number') {
    const d = new Date(dayOrTimestamp)
    year = d.getFullYear()
    month = d.getMonth() + 1
    date = d.getDate()
  } else {
    const parts = dayOrTimestamp.split('-').map(Number)
    if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) return dayOrTimestamp
    ;[year, month, date] = parts
  }
  return `${year} ${MONTHS[month - 1]} ${date}`
}

/** Groups an integer with commas: 2800 -> "2,800". Hand-rolled — the app
 * avoids Intl, and counts are the only numbers ever grouped. */
export function formatThousands(value: number): string {
  return String(Math.trunc(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** Formats a YYYY-MM month key as the bare month name, like "Nov". */
export function formatMonthShort(month: string): string {
  const monthIndex = Number(month.slice(5, 7))
  if (!monthIndex) return month
  return MONTHS[monthIndex - 1]
}

/** Formats a YYYY-MM month key as a short label like "Nov 2026". */
export function formatMonthLabel(month: string): string {
  const [year, monthIndex] = month.split('-').map(Number)
  if (!year || !monthIndex) return month
  return `${MONTHS[monthIndex - 1]} ${year}`
}

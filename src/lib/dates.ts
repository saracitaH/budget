// Dates au format local « AAAA-MM-JJ » ; mois au format « AAAA-MM ».

const pad = (n: number) => String(n).padStart(2, '0')

export function localISO(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function monthOf(iso: string): string {
  return iso.slice(0, 7)
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d ?? 1)
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso)
  d.setDate(d.getDate() + n)
  return localISO(d)
}

export function daysInMonth(monthId: string): number {
  const [y, m] = monthId.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export function dayOfMonth(iso: string): number {
  return Number(iso.slice(8, 10))
}

const fmtDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
const fmtMonth = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })
const fmtLong = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' })

/** « Aujourd'hui », « Hier » ou « mer. 8 oct. » */
export function dayLabel(iso: string, today: string): string {
  if (iso === today) return "Aujourd'hui"
  if (iso === addDays(today, -1)) return 'Hier'
  return fmtDay.format(parseISO(iso))
}

export function monthLabel(monthId: string): string {
  return fmtMonth.format(parseISO(monthId + '-01'))
}

export function longDate(isoDateTime: string): string {
  return fmtLong.format(new Date(isoDateTime))
}

/** Nombre de jours entiers écoulés depuis une date-heure ISO. */
export function daysSince(isoDateTime: string, now = new Date()): number {
  return Math.floor((now.getTime() - new Date(isoDateTime).getTime()) / 86_400_000)
}

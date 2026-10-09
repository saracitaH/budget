// Tous les montants sont stockés en centimes (entiers) pour éviter les erreurs d'arrondi.

const fmtInt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const fmtDec = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })

/** 1250 → « 12,50 € », 35000 → « 350 € » */
export function formatEUR(cents: number): string {
  return cents % 100 === 0 ? fmtInt.format(cents / 100) : fmtDec.format(cents / 100)
}

/** Arrondi à l'euro, pour les vues de synthèse : 41290 → « 413 € » */
export function formatEURRounded(cents: number): string {
  return fmtInt.format(Math.round(cents / 100))
}

/** « 1 850,5 », « 12.30 € » → centimes ; null si illisible ou négatif. */
export function parseAmount(input: string): number | null {
  const clean = input.replace(/[\s  €]/g, '').replace(',', '.')
  if (clean === '') return 0
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return null
  return Math.round(parseFloat(clean) * 100)
}

/** Centimes → texte modifiable dans un champ : 185050 → « 1850,50 », 30000 → « 300 » */
export function centsToInput(cents: number): string {
  if (!cents) return ''
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2).replace('.', ',')
}

export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | ',' | 'back'

/** Applique une touche du pavé numérique au texte saisi (ex. « 12,5 »). */
export function applyKey(current: string, key: KeypadKey): string {
  if (key === 'back') return current.slice(0, -1)
  const [int, dec] = current.split(',')
  if (key === ',') {
    if (dec !== undefined) return current
    return (current === '' ? '0' : current) + ','
  }
  if (dec !== undefined) return dec.length >= 2 ? current : current + key
  if (int.length >= 6) return current
  if (current === '0') return key
  return current + key
}

export function keypadToCents(s: string): number {
  return parseAmount(s) ?? 0
}

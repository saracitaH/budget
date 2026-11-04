// Bilan d'un mois : regroupement des dépenses par libellé, plus gros postes et pistes d'économie.

import type { MonthStats } from './budget'
import { daysInMonth, dayOfMonth } from './dates'
import { EXTRA_INCOME, type Category, type Subcategory, type Transaction } from './db'

export interface LabelGroup {
  /** Clé normalisée (minuscules, sans accents ni chiffres) */
  key: string
  /** Orthographe la plus fréquente, pour l'affichage */
  name: string
  /** false = dépenses sans libellé, regroupées par catégorie */
  labelled: boolean
  /** Total net en centimes (remboursements déduits) */
  total: number
  count: number
  /** Part des dépenses du mois (0 à 1) */
  share: number
  /** Catégorie principale (celle qui porte le plus gros montant) */
  categoryId: string
  /** Toutes les catégories où ce libellé apparaît */
  categoryIds: string[]
  /** Ids des dépenses du groupe */
  txIds: string[]
  /** Combien ont déjà une sous-catégorie */
  withSub: number
}

export type Tip =
  | { kind: 'over'; categoryId: string; amount: number }
  | { kind: 'slack'; categoryId: string; budget: number; spent: number; cut: number }
  | { kind: 'small'; group: LabelGroup; average: number; saving: number }
  | { kind: 'subcategory'; group: LabelGroup }
  | { kind: 'scattered'; group: LabelGroup }

export interface Review {
  groups: LabelGroup[]
  /** Les plus grosses dépenses à l'unité */
  biggest: Transaction[]
  /** Dépensé net par jour du mois (index 0 = le 1er) */
  daily: number[]
  /** Part des dépenses saisies avec un libellé (0 à 1) */
  labelledShare: number
  tips: Tip[]
  /** Somme des baisses de budget proposées (catégories peu utilisées) */
  possibleCut: number
}

const STEP = 500 // arrondi des propositions à 5 €
const MIN_CUT = 1000 // en dessous de 10 €, pas la peine de proposer une baisse
const SMALL_AVERAGE = 1500 // « petite dépense » : moins de 15 € en moyenne
const SMALL_MIN_COUNT = 4
const SUB_MIN_COUNT = 3

/** « Café ! », « cafe 2 » et « CAFÉ » donnent la même clé « cafe ». */
export function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const UNLABELLED = '__sans-libelle:'

/** À égalité, « Amazon » l'emporte sur « amazon » pour l'affichage */
const capitalised = (s: string) => (s[0] !== s[0].toLowerCase() ? 1 : 0)

export function buildReview(
  stats: MonthStats,
  allTransactions: Transaction[],
  categories: Category[],
  subcategories: Subcategory[] = [],
): Review {
  const tx = allTransactions.filter((t) => t.categoryId !== EXTRA_INCOME)
  const totalSpent = tx.reduce((s, t) => s + t.amount, 0)
  const catName = new Map(categories.map((c) => [c.id, c.name]))

  // ── Regroupement par libellé ──
  const raw = new Map<string, { spellings: Map<string, number>; items: Transaction[] }>()
  for (const t of tx) {
    const norm = t.label ? normalizeLabel(t.label) : ''
    const key = norm || UNLABELLED + t.categoryId
    const g = raw.get(key) ?? { spellings: new Map<string, number>(), items: [] as Transaction[] }
    if (norm && t.label) g.spellings.set(t.label.trim(), (g.spellings.get(t.label.trim()) ?? 0) + 1)
    g.items.push(t)
    raw.set(key, g)
  }

  const groups: LabelGroup[] = [...raw].map(([key, g]) => {
    const labelled = !key.startsWith(UNLABELLED)
    const byCat = new Map<string, number>()
    for (const t of g.items) byCat.set(t.categoryId, (byCat.get(t.categoryId) ?? 0) + t.amount)
    const categoryIds = [...byCat].sort((a, b) => b[1] - a[1]).map(([id]) => id)
    const total = g.items.reduce((s, t) => s + t.amount, 0)
    const name = labelled
      ? [...g.spellings].sort((a, b) => b[1] - a[1] || capitalised(b[0]) - capitalised(a[0]) || a[0].localeCompare(b[0]))[0][0]
      : `Sans libellé · ${catName.get(categoryIds[0]) ?? 'Autre'}`
    return {
      key,
      name,
      labelled,
      total,
      count: g.items.filter((t) => t.amount > 0).length,
      share: totalSpent > 0 ? total / totalSpent : 0,
      categoryId: categoryIds[0],
      categoryIds,
      txIds: g.items.map((t) => t.id),
      withSub: g.items.filter((t) => t.subcategoryId).length,
    }
  })
  groups.sort((a, b) => b.total - a.total || b.count - a.count)

  const biggest = tx
    .filter((t) => t.amount > 0)
    .sort((a, b) => b.amount - a.amount || a.date.localeCompare(b.date))
    .slice(0, 5)

  const daily = new Array(daysInMonth(stats.monthId)).fill(0)
  for (const t of tx) daily[dayOfMonth(t.date) - 1] += t.amount

  const labelledSpent = tx.filter((t) => t.label && t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const positiveSpent = tx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)

  // ── Pistes ──
  const over = stats.categories
    .filter((c) => c.budget > 0 && c.spent > c.budget)
    .map((c) => ({ kind: 'over' as const, categoryId: c.category.id, amount: c.spent - c.budget }))
    .sort((a, b) => b.amount - a.amount)

  const slack = stats.categories
    .filter((c) => c.budget > 0)
    .map((c) => ({
      kind: 'slack' as const,
      categoryId: c.category.id,
      budget: c.budget,
      spent: c.spent,
      // On garde une marge de 10 % du budget pour ne pas viser trop juste
      cut: Math.floor((c.budget - Math.max(0, c.spent) - c.budget * 0.1) / STEP) * STEP,
    }))
    .filter((t) => t.cut >= MIN_CUT)
    .sort((a, b) => b.cut - a.cut)


  const small: Tip[] = []
  const scattered: Tip[] = []
  const toSub: Tip[] = []
  const labelled = groups.filter((g) => g.labelled)
  for (const g of labelled) {
    const average = g.count > 0 ? g.total / g.count : 0
    if (g.count >= SMALL_MIN_COUNT && average > 0 && average < SMALL_AVERAGE) {
      small.push({ kind: 'small', group: g, average, saving: Math.round(g.total / 2 / 100) * 100 })
    }
  }
  for (const g of labelled) {
    if (g.categoryIds.length > 1) scattered.push({ kind: 'scattered', group: g })
  }
  for (const g of labelled) {
    if (g.count < SUB_MIN_COUNT || g.categoryIds.length > 1 || g.withSub === g.txIds.length) continue
    // Déjà une sous-catégorie du même nom dans la catégorie : rien à proposer
    const exists = subcategories.some(
      (s) => !s.archived && s.categoryId === g.categoryId && normalizeLabel(s.name) === g.key,
    )
    if (!exists) toSub.push({ kind: 'subcategory', group: g })
  }
  // Les 3 plus grosses marges d'abord, les autres en fin de liste
  const tips: Tip[] = [...over, ...slack.slice(0, 3), ...small, ...toSub, ...scattered, ...slack.slice(3)]

  return {
    groups,
    biggest,
    daily,
    labelledShare: positiveSpent > 0 ? labelledSpent / positiveSpent : 0,
    tips,
    possibleCut: slack.reduce((s, t) => s + t.cut, 0),
  }
}

import Dexie, { type EntityTable } from 'dexie'
import { defaultCategories } from './categories'
import { localISO, monthOf } from './dates'

export interface Meta {
  key: string
  value: unknown
}

export interface Category {
  id: string
  name: string
  emoji: string
  color: string
  order: number
  /** Budget mensuel en centimes */
  budget: number
  archived: boolean
}

export type TxSource = 'manual' | 'recurring' | 'applepay' | 'import'

export interface Transaction {
  id: string
  /** Centimes ; négatif = remboursement */
  amount: number
  /** AAAA-MM-JJ */
  date: string
  /** AAAA-MM, dérivé de date, indexé pour les requêtes par mois */
  month: string
  categoryId: string
  label?: string
  source: TxSource
  createdAt: string
  updatedAt: string
}

export interface Recurring {
  id: string
  label: string
  amount: number
  /** 'fixed' = charge fixe déduite d'office ; 'expense' = dépense de catégorie (V3) */
  kind: 'fixed' | 'expense'
  dayOfMonth?: number
  categoryId?: string
  active: boolean
}

/** Copie figée des paramètres d'un mois, pour que l'historique ne bouge pas quand on modifie le budget. */
export interface Month {
  id: string
  income: number
  fixedCharges: number
  savingsGoal: number
  budgets: Record<string, number>
  closed: boolean
}

export type Theme = 'auto' | 'light' | 'dark'

export interface Settings {
  income: number
  savingsGoal: number
  onboarded: boolean
  lastBackupAt: string | null
  theme: Theme
}

const DEFAULT_SETTINGS: Settings = {
  income: 0,
  savingsGoal: 0,
  onboarded: false,
  lastBackupAt: null,
  theme: 'auto',
}

export const db = new Dexie('budget') as Dexie & {
  meta: EntityTable<Meta, 'key'>
  categories: EntityTable<Category, 'id'>
  transactions: EntityTable<Transaction, 'id'>
  recurring: EntityTable<Recurring, 'id'>
  months: EntityTable<Month, 'id'>
}

db.version(1).stores({
  meta: 'key',
})

db.version(2)
  .stores({
    meta: 'key',
    categories: 'id, order',
    transactions: 'id, month, date, categoryId',
    recurring: 'id, kind',
    months: 'id',
  })
  .upgrade((tx) => tx.table('meta').where('key').startsWith('v0-').delete())

// randomUUID n'existe qu'en contexte sécurisé (HTTPS) : repli pour le test en wifi local.
export function newId(): string {
  if (crypto.randomUUID) return crypto.randomUUID()
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

export async function getSettings(): Promise<Settings> {
  const stored = (await db.meta.get('settings'))?.value as Partial<Settings> | undefined
  return { ...DEFAULT_SETTINGS, ...stored }
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  await db.transaction('rw', db.meta, async () => {
    const current = await getSettings()
    await db.meta.put({ key: 'settings', value: { ...current, ...patch } })
  })
}

/** Crée les catégories par défaut au premier lancement. */
export async function ensureSeed(): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    if ((await db.categories.count()) === 0) await db.categories.bulkAdd(defaultCategories())
  })
}

async function buildMonth(id: string): Promise<Month> {
  const settings = await getSettings()
  const categories = await db.categories.toArray()
  const fixed = await db.recurring.where('kind').equals('fixed').toArray()
  return {
    id,
    income: settings.income,
    savingsGoal: settings.savingsGoal,
    fixedCharges: fixed.filter((r) => r.active).reduce((s, r) => s + r.amount, 0),
    budgets: Object.fromEntries(categories.filter((c) => !c.archived).map((c) => [c.id, c.budget])),
    closed: false,
  }
}

/** Crée la fiche d'un mois à partir des réglages actuels si elle n'existe pas encore. */
export async function ensureMonth(id: string): Promise<void> {
  await db.transaction('rw', [db.months, db.meta, db.categories, db.recurring], async () => {
    if (!(await db.months.get(id))) await db.months.put(await buildMonth(id))
  })
}

/** Après un changement de budget : le mois en cours reflète les nouveaux réglages, les mois passés restent figés. */
export async function syncCurrentMonth(): Promise<void> {
  const id = monthOf(localISO())
  await db.transaction('rw', [db.months, db.meta, db.categories, db.recurring], async () => {
    await db.months.put(await buildMonth(id))
  })
}

export async function addTransaction(input: {
  amount: number
  date: string
  categoryId: string
  label?: string
  source?: TxSource
}): Promise<Transaction> {
  const now = new Date().toISOString()
  const tx: Transaction = {
    id: newId(),
    amount: input.amount,
    date: input.date,
    month: monthOf(input.date),
    categoryId: input.categoryId,
    label: input.label?.trim() || undefined,
    source: input.source ?? 'manual',
    createdAt: now,
    updatedAt: now,
  }
  await ensureMonth(tx.month)
  await db.transactions.add(tx)
  return tx
}

export async function updateTransaction(
  id: string,
  patch: Partial<Pick<Transaction, 'amount' | 'date' | 'categoryId' | 'label'>>,
): Promise<void> {
  const changes: Partial<Transaction> = { ...patch, updatedAt: new Date().toISOString() }
  if (patch.date) {
    changes.month = monthOf(patch.date)
    await ensureMonth(changes.month)
  }
  if ('label' in patch) changes.label = patch.label?.trim() || undefined
  await db.transactions.update(id, changes)
}

export async function deleteTransaction(id: string): Promise<void> {
  await db.transactions.delete(id)
}

export interface FixedChargeInput {
  id?: string
  label: string
  amount: number
}

export async function saveFixedCharges(items: FixedChargeInput[]): Promise<void> {
  await db.transaction('rw', db.recurring, async () => {
    await db.recurring.where('kind').equals('fixed').delete()
    await db.recurring.bulkAdd(
      items
        .filter((i) => i.amount > 0 || i.label.trim())
        .map((i) => ({ id: i.id ?? newId(), label: i.label.trim(), amount: i.amount, kind: 'fixed' as const, active: true })),
    )
  })
}

export async function saveCategoryBudgets(budgets: Record<string, number>): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    for (const [id, budget] of Object.entries(budgets)) await db.categories.update(id, { budget })
  })
}

export async function completeOnboarding(input: {
  income: number
  savingsGoal: number
  fixed: FixedChargeInput[]
  budgets: Record<string, number>
}): Promise<void> {
  await saveFixedCharges(input.fixed)
  await saveCategoryBudgets(input.budgets)
  await updateSettings({ income: input.income, savingsGoal: input.savingsGoal, onboarded: true })
  await syncCurrentMonth()
}

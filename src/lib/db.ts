import Dexie, { type EntityTable } from 'dexie'
import { DEFAULT_SUBCATEGORIES, defaultCategories, nextColor } from './categories'
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

export interface Subcategory {
  id: string
  categoryId: string
  name: string
  emoji: string
  order: number
  /** Budget propre facultatif (centimes) ; null = partage le budget de la catégorie */
  budget: number | null
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
  subcategoryId?: string
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
  /** Budgets des sous-catégories qui en ont un (absent sur les mois créés avant la V1.1) */
  subBudgets?: Record<string, number>
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
  subcategories: EntityTable<Subcategory, 'id'>
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

db.version(3).stores({
  subcategories: 'id, categoryId, order',
})

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

/**
 * Crée les catégories par défaut au premier lancement, puis les sous-catégories par défaut
 * une seule fois (un drapeau évite de les recréer si tu les supprimes).
 */
export async function ensureSeed(): Promise<void> {
  await db.transaction('rw', [db.categories, db.subcategories, db.meta], async () => {
    if ((await db.categories.count()) === 0) await db.categories.bulkAdd(defaultCategories())
    if (!(await db.meta.get('seed:subcategories'))) {
      for (const [categoryId, subs] of Object.entries(DEFAULT_SUBCATEGORIES)) {
        if (!(await db.categories.get(categoryId))) continue
        if ((await db.subcategories.where('categoryId').equals(categoryId).count()) > 0) continue
        await db.subcategories.bulkAdd(
          subs.map((s, i) => ({ ...s, id: newId(), categoryId, order: i, budget: null, archived: false })),
        )
      }
      await db.meta.put({ key: 'seed:subcategories', value: true })
    }
  })
}

const MONTH_TABLES = () => [db.months, db.meta, db.categories, db.subcategories, db.recurring]

async function buildMonth(id: string): Promise<Month> {
  const settings = await getSettings()
  const categories = (await db.categories.toArray()).filter((c) => !c.archived)
  const activeIds = new Set(categories.map((c) => c.id))
  const subs = (await db.subcategories.toArray()).filter(
    (s) => !s.archived && s.budget !== null && activeIds.has(s.categoryId),
  )
  const fixed = await db.recurring.where('kind').equals('fixed').toArray()
  return {
    id,
    income: settings.income,
    savingsGoal: settings.savingsGoal,
    fixedCharges: fixed.filter((r) => r.active).reduce((s, r) => s + r.amount, 0),
    budgets: Object.fromEntries(categories.map((c) => [c.id, c.budget])),
    subBudgets: Object.fromEntries(subs.map((s) => [s.id, s.budget as number])),
    closed: false,
  }
}

/** Crée la fiche d'un mois à partir des réglages actuels si elle n'existe pas encore. */
export async function ensureMonth(id: string): Promise<void> {
  await db.transaction('rw', MONTH_TABLES(), async () => {
    if (!(await db.months.get(id))) await db.months.put(await buildMonth(id))
  })
}

/** Après un changement de budget : le mois en cours reflète les nouveaux réglages, les mois passés restent figés. */
export async function syncCurrentMonth(): Promise<void> {
  const id = monthOf(localISO())
  await db.transaction('rw', MONTH_TABLES(), async () => {
    await db.months.put(await buildMonth(id))
  })
}

// ── Dépenses ──────────────────────────────────────────────────────────────

export async function addTransaction(input: {
  amount: number
  date: string
  categoryId: string
  subcategoryId?: string
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
    subcategoryId: input.subcategoryId,
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
  patch: Partial<Pick<Transaction, 'amount' | 'date' | 'categoryId' | 'subcategoryId' | 'label'>>,
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

// ── Budget ────────────────────────────────────────────────────────────────

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

// ── Catégories et sous-catégories ─────────────────────────────────────────

export async function addCategory(input: { name: string; emoji: string }): Promise<Category> {
  const all = await db.categories.toArray()
  const category: Category = {
    id: newId(),
    name: input.name.trim(),
    emoji: input.emoji.trim() || '🏷️',
    color: nextColor(all.length),
    order: Math.max(-1, ...all.map((c) => c.order)) + 1,
    budget: 0,
    archived: false,
  }
  await db.categories.add(category)
  await syncCurrentMonth()
  return category
}

export async function updateCategory(id: string, patch: Partial<Pick<Category, 'name' | 'emoji'>>): Promise<void> {
  await db.categories.update(id, patch)
}

/** Échange la position avec la catégorie visible voisine (−1 = vers le haut). */
export async function moveCategory(id: string, direction: -1 | 1): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    const list = (await db.categories.orderBy('order').toArray()).filter((c) => !c.archived)
    const i = list.findIndex((c) => c.id === id)
    const j = i + direction
    if (i < 0 || j < 0 || j >= list.length) return
    await db.categories.update(list[i].id, { order: list[j].order })
    await db.categories.update(list[j].id, { order: list[i].order })
  })
}

/**
 * Sans dépense rattachée : suppression définitive. Sinon : masquée (l'historique reste lisible).
 * Renvoie 'deleted' ou 'archived'.
 */
export async function removeCategory(id: string): Promise<'deleted' | 'archived'> {
  const result = await db.transaction('rw', [db.categories, db.subcategories, db.transactions], async () => {
    if ((await db.transactions.where('categoryId').equals(id).count()) === 0) {
      await db.subcategories.where('categoryId').equals(id).delete()
      await db.categories.delete(id)
      return 'deleted' as const
    }
    await db.categories.update(id, { archived: true })
    return 'archived' as const
  })
  await syncCurrentMonth()
  return result
}

export async function addSubcategory(categoryId: string, input: { name: string; emoji: string }): Promise<void> {
  const siblings = await db.subcategories.where('categoryId').equals(categoryId).toArray()
  await db.subcategories.add({
    id: newId(),
    categoryId,
    name: input.name.trim(),
    emoji: input.emoji.trim(),
    order: Math.max(-1, ...siblings.map((s) => s.order)) + 1,
    budget: null,
    archived: false,
  })
}

export async function updateSubcategory(
  id: string,
  patch: Partial<Pick<Subcategory, 'name' | 'emoji' | 'budget'>>,
): Promise<void> {
  await db.subcategories.update(id, patch)
  if ('budget' in patch) await syncCurrentMonth()
}

export async function removeSubcategory(id: string): Promise<void> {
  await db.transaction('rw', [db.subcategories, db.transactions], async () => {
    const used = await db.transactions.filter((t) => t.subcategoryId === id).count()
    if (used === 0) await db.subcategories.delete(id)
    else await db.subcategories.update(id, { archived: true })
  })
  await syncCurrentMonth()
}

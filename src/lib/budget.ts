import { dayOfMonth, daysInMonth, monthOf } from './dates'
import { EXTRA_INCOME, type Category, type Month, type Subcategory, type Transaction } from './db'

/**
 * ok    : sous le rythme prévu
 * pace  : dépense plus vite que le rythme du mois
 * warn  : 80 % du budget consommé
 * over  : budget dépassé
 */
export type Status = 'ok' | 'pace' | 'warn' | 'over'

export interface SubStat {
  /** null = dépenses de la catégorie sans sous-catégorie (« Sans précision ») */
  sub: Subcategory | null
  /** null = pas de budget propre */
  budget: number | null
  spent: number
  remaining: number | null
  status: Status | null
}

export interface CategoryStat {
  category: Category
  /** Détail par sous-catégorie ; vide si la catégorie n'en a pas */
  subs: SubStat[]
  budget: number
  spent: number
  remaining: number
  /** spent / budget (Infinity si budget nul et dépense > 0) */
  ratio: number
  /** Dépense « attendue » à ce jour si on suivait un rythme régulier */
  expected: number
  status: Status
}

export interface MonthStats {
  monthId: string
  categories: CategoryStat[]
  totalBudget: number
  totalSpent: number
  remaining: number
  daysInMonth: number
  /** Jour courant dans le mois (0 = mois futur, daysInMonth = mois passé) */
  day: number
  /** Fraction du mois écoulée, jour courant inclus */
  elapsed: number
  /** Jours restants, aujourd'hui inclus */
  daysLeft: number
  perDay: number
  income: number
  /** Rentrées exceptionnelles du mois (cadeau, vente…), qui s'ajoutent à l'épargne */
  extraIncome: number
  fixedCharges: number
  savingsGoal: number
  /** Budget disponible pour les catégories : revenus − charges fixes − épargne */
  available: number
  /**
   * Épargne projetée en fin de mois, en supposant que chaque catégorie consomme tout son budget :
   * revenus + rentrées − charges fixes − Σ max(budget, dépensé). Elle baisse dès qu'une catégorie dépasse.
   */
  projectedSavings: number
  onTrack: boolean
  status: Status
}

const PACE_TOLERANCE = 0.1 // 10 % du budget d'avance sur le rythme avant d'alerter
const WARN_RATIO = 0.8

export function statusFor(spent: number, budget: number, expected: number): Status {
  if (budget <= 0) return spent > 0 ? 'over' : 'ok'
  if (spent > budget) return 'over'
  if (spent >= budget * WARN_RATIO) return 'warn'
  if (spent > expected + budget * PACE_TOLERANCE) return 'pace'
  return 'ok'
}

export function computeStats(
  month: Month,
  categories: Category[],
  allTransactions: Transaction[],
  today: string,
  subcategories: Subcategory[] = [],
): MonthStats {
  // Les rentrées exceptionnelles ne sont pas des dépenses : elles vont aux revenus du mois
  const transactions = allTransactions.filter((t) => t.categoryId !== EXTRA_INCOME)
  const extraIncome = allTransactions.filter((t) => t.categoryId === EXTRA_INCOME).reduce((s, t) => s + t.amount, 0)

  const dim = daysInMonth(month.id)
  const currentMonth = monthOf(today)
  const day = month.id === currentMonth ? dayOfMonth(today) : month.id < currentMonth ? dim : 0
  const elapsed = day / dim
  const daysLeft = Math.max(1, dim - day + 1)

  const spentBy = new Map<string, number>()
  const spentBySub = new Map<string, number>()
  for (const t of transactions) {
    spentBy.set(t.categoryId, (spentBy.get(t.categoryId) ?? 0) + t.amount)
    const subKey = `${t.categoryId}/${t.subcategoryId ?? ''}`
    spentBySub.set(subKey, (spentBySub.get(subKey) ?? 0) + t.amount)
  }
  const subBudgets = month.subBudgets ?? {}

  function subStats(category: Category): SubStat[] {
    const own = subcategories
      .filter((s) => s.categoryId === category.id && (!s.archived || spentBySub.has(`${category.id}/${s.id}`)))
      .sort((a, b) => a.order - b.order)
    if (own.length === 0) return []
    const rows: SubStat[] = own.map((sub) => {
      const spent = spentBySub.get(`${category.id}/${sub.id}`) ?? 0
      const budget = sub.id in subBudgets ? subBudgets[sub.id] : null
      return {
        sub,
        budget,
        spent,
        remaining: budget === null ? null : budget - spent,
        status: budget === null ? null : statusFor(spent, budget, budget * elapsed),
      }
    })
    const unassigned = spentBySub.get(`${category.id}/`) ?? 0
    if (unassigned !== 0) rows.push({ sub: null, budget: null, spent: unassigned, remaining: null, status: null })
    return rows
  }

  // Catégories budgétées ce mois-ci, plus celles qui ont des dépenses sans budget (ex. archivées depuis)
  const shown = categories.filter((c) => !c.archived || spentBy.has(c.id))
  const stats: CategoryStat[] = shown.map((category) => {
    const budget = month.budgets[category.id] ?? 0
    const spent = spentBy.get(category.id) ?? 0
    const expected = budget * elapsed
    return {
      category,
      subs: subStats(category),
      budget,
      spent,
      remaining: budget - spent,
      ratio: budget > 0 ? spent / budget : spent > 0 ? Infinity : 0,
      expected,
      status: statusFor(spent, budget, expected),
    }
  })

  const totalBudget = stats.reduce((s, c) => s + c.budget, 0)
  const totalSpent = transactions.reduce((s, t) => s + t.amount, 0)
  const remaining = totalBudget - totalSpent
  const knownIds = new Set(shown.map((c) => c.id))
  const orphanSpent = transactions.filter((t) => !knownIds.has(t.categoryId)).reduce((s, t) => s + t.amount, 0)
  const committed = stats.reduce((s, c) => s + Math.max(c.budget, c.spent), 0) + orphanSpent
  const projectedSavings = month.income + extraIncome - month.fixedCharges - committed

  return {
    monthId: month.id,
    categories: stats,
    totalBudget,
    totalSpent,
    remaining,
    daysInMonth: dim,
    day,
    elapsed,
    daysLeft,
    perDay: Math.max(0, remaining) / daysLeft,
    income: month.income,
    extraIncome,
    fixedCharges: month.fixedCharges,
    savingsGoal: month.savingsGoal,
    available: month.income - month.fixedCharges - month.savingsGoal,
    projectedSavings,
    onTrack: projectedSavings >= month.savingsGoal,
    status: statusFor(totalSpent, totalBudget, totalBudget * elapsed),
  }
}

import { describe, expect, it } from 'vitest'
import { computeStats, statusFor } from './budget'
import { proposeBudgets } from './categories'
import type { Category, Month, Subcategory, Transaction } from './db'

const cat = (id: string, budget: number): Category => ({
  id,
  name: id,
  emoji: '',
  color: '',
  order: 0,
  budget,
  archived: false,
})

const tx = (categoryId: string, amount: number, date = '2026-10-05'): Transaction => ({
  id: Math.random().toString(),
  amount,
  date,
  month: date.slice(0, 7),
  categoryId,
  source: 'manual',
  createdAt: '',
  updatedAt: '',
})

const month: Month = {
  id: '2026-10',
  income: 250000,
  fixedCharges: 100000,
  savingsGoal: 30000,
  budgets: { courses: 40000, sorties: 20000 },
  closed: false,
}

describe('statusFor', () => {
  it('signale un dépassement', () => expect(statusFor(101, 100, 50)).toBe('over'))
  it('alerte à 80 %', () => expect(statusFor(80, 100, 90)).toBe('warn'))
  it('alerte si en avance sur le rythme au-delà de la tolérance', () => expect(statusFor(61, 100, 50)).toBe('pace'))
  it('tolère une petite avance', () => expect(statusFor(59, 100, 50)).toBe('ok'))
  it('dépense sans budget = dépassement', () => expect(statusFor(1, 0, 0)).toBe('over'))
})

describe('computeStats', () => {
  const cats = [cat('courses', 40000), cat('sorties', 20000)]

  it('calcule restes, rythme et épargne projetée', () => {
    const s = computeStats(month, cats, [tx('courses', 10000), tx('sorties', 5000)], '2026-10-10')
    expect(s.totalBudget).toBe(60000)
    expect(s.totalSpent).toBe(15000)
    expect(s.remaining).toBe(45000)
    expect(s.daysInMonth).toBe(31)
    expect(s.daysLeft).toBe(22)
    expect(s.perDay).toBeCloseTo(45000 / 22)
    // 2500 − 1000 − (400 + 200) = 900 € ; objectif 300 € (non réparti : 600 €)
    expect(s.projectedSavings).toBe(90000)
    expect(s.onTrack).toBe(true)
  })

  it("un dépassement réduit l'épargne projetée", () => {
    const tight: Month = { ...month, budgets: { courses: 90000, sorties: 30000 } }
    const s = computeStats(tight, cats, [tx('sorties', 50000)], '2026-10-10')
    // 2500 − 1000 − (900 + 500) = 100 € < 300 €
    expect(s.projectedSavings).toBe(10000)
    expect(s.onTrack).toBe(false)
    expect(s.categories.find((c) => c.category.id === 'sorties')?.status).toBe('over')
  })

  it('détaille les sous-catégories, avec budget facultatif et « Sans précision »', () => {
    const sub = (id: string, archived = false): Subcategory => ({
      id,
      categoryId: 'sorties',
      name: id,
      emoji: '',
      order: 0,
      budget: null,
      archived,
    })
    const subs = [sub('bar'), sub('resto'), sub('ancienne', true)]
    const withSub = (id: string | undefined, amount: number) => ({ ...tx('sorties', amount), subcategoryId: id })
    const s = computeStats(
      { ...month, subBudgets: { bar: 6000 } },
      cats,
      [withSub('bar', 4800), withSub('resto', 4200), withSub(undefined, 1000)],
      '2026-10-10',
      subs,
    )
    const sorties = s.categories.find((c) => c.category.id === 'sorties')!
    expect(sorties.spent).toBe(10000)
    expect(sorties.subs.map((r) => [r.sub?.id ?? null, r.spent, r.remaining])).toEqual([
      ['bar', 4800, 1200],
      ['resto', 4200, null],
      [null, 1000, null],
    ])
    expect(sorties.subs[0].status).toBe('warn')
    expect(s.categories.find((c) => c.category.id === 'courses')!.subs).toEqual([])
  })

  it('un remboursement redonne de la marge à sa catégorie', () => {
    const s = computeStats(month, cats, [tx('sorties', 6000), tx('sorties', -2000)], '2026-10-10')
    const sorties = s.categories.find((c) => c.category.id === 'sorties')!
    expect(sorties.spent).toBe(4000)
    expect(sorties.remaining).toBe(16000)
    expect(s.remaining).toBe(56000)
  })

  it('une rentrée exceptionnelle augmente l\'épargne sans toucher aux catégories', () => {
    const s = computeStats(month, cats, [tx('courses', 10000), tx('__rentree', 3500)], '2026-10-10')
    expect(s.extraIncome).toBe(3500)
    expect(s.totalSpent).toBe(10000)
    expect(s.remaining).toBe(50000)
    // 2500 + 35 − 1000 − 600 = 935 €
    expect(s.projectedSavings).toBe(93500)
    expect(s.categories.map((c) => c.category.id)).toEqual(['courses', 'sorties'])
  })

  it('un mois passé est considéré comme entièrement écoulé', () => {
    const s = computeStats({ ...month, id: '2026-09' }, cats, [], '2026-10-10')
    expect(s.elapsed).toBe(1)
  })
})

describe('proposeBudgets', () => {
  it('répartit selon les pondérations, arrondi à 5 € sans dépasser le disponible', () => {
    const ids = ['courses', 'sorties', 'shopping', 'transport', 'maison', 'loisirs', 'sante', 'cadeaux', 'divers']
    const b = proposeBudgets(120000, ids.map((id) => ({ id })))
    expect(b.courses).toBe(36000)
    expect(Object.values(b).every((v) => v % 500 === 0)).toBe(true)
    expect(Object.values(b).reduce((a, v) => a + v, 0)).toBeLessThanOrEqual(120000)
  })
})

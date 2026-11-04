import { describe, expect, it } from 'vitest'
import { computeStats } from './budget'
import type { Category, Month, Subcategory, Transaction } from './db'
import { buildReview, normalizeLabel, UNTRACKED } from './review'

const cat = (id: string, budget: number): Category => ({
  id,
  name: id,
  emoji: '',
  color: '',
  order: 0,
  budget,
  archived: false,
})

let seq = 0
const tx = (categoryId: string, amount: number, label?: string, date = '2026-10-05'): Transaction => ({
  id: String(++seq),
  amount,
  date,
  month: date.slice(0, 7),
  categoryId,
  label,
  source: 'manual',
  createdAt: '',
  updatedAt: '',
})

const month: Month = {
  id: '2026-10',
  income: 250000,
  fixedCharges: 100000,
  savingsGoal: 50000,
  budgets: { courses: 40000, sorties: 20000, loisirs: 10000 },
  closed: false,
}
const cats = [cat('courses', 40000), cat('sorties', 20000), cat('loisirs', 10000)]

function review(list: Transaction[], subs: Subcategory[] = []) {
  const stats = computeStats(month, cats, list, '2026-11-04', subs)
  return { stats, review: buildReview(stats, list, cats, subs) }
}

describe('normalizeLabel', () => {
  it('ignore casse, accents, chiffres et ponctuation', () => {
    expect(normalizeLabel('  Café ! ')).toBe('cafe')
    expect(normalizeLabel('CAFE 2')).toBe('cafe')
    expect(normalizeLabel('Carrefour 12/10')).toBe('carrefour')
  })
})

describe('buildReview', () => {
  it('regroupe par libellé, garde l’orthographe la plus fréquente, trie par montant', () => {
    const { review: r } = review([
      tx('courses', 6000, 'Carrefour'),
      tx('courses', 4000, 'carrefour'),
      tx('courses', 3000, 'Carrefour'),
      tx('sorties', 2000, 'Café'),
      tx('sorties', 1500),
    ])
    expect(r.groups.map((g) => [g.name, g.total, g.count])).toEqual([
      ['Carrefour', 13000, 3],
      ['Café', 2000, 1],
      ['Sans libellé · sorties', 1500, 1],
    ])
    expect(r.groups[0].share).toBeCloseTo(13000 / 16500)
    expect(r.labelledShare).toBeCloseTo(15000 / 16500)
  })

  it('un mois terminé compte l’épargne réellement faite', () => {
    const { stats } = review([tx('courses', 10000)])
    expect(stats.finished).toBe(true)
    // 2500 − 1000 − 100 = 1400 €, le budget non dépensé part à l'épargne
    expect(stats.projectedSavings).toBe(140000)
  })

  it('propose de baisser les budgets peu utilisés, arrondi à 5 €, avec 10 % de marge', () => {
    const { review: r } = review([tx('courses', 39000), tx('loisirs', 2000), tx('sorties', 25000)])
    const slack = r.tips.filter((t) => t.kind === 'slack')
    // Loisirs : 100 − 20 − 10 = 70 € ; courses et sorties : rien
    expect(slack).toEqual([{ kind: 'slack', categoryId: 'loisirs', budget: 10000, spent: 2000, cut: 7000 }])
    expect(r.possibleCut).toBe(7000)
    expect(r.tips[0]).toEqual({ kind: 'over', categoryId: 'sorties', amount: 5000 })
  })

  it('repère les petites dépenses répétées, les libellés éparpillés et les sous-catégories à créer', () => {
    const coffees = [1, 2, 3, 4].map((d) => tx('sorties', 350, 'Café', `2026-10-0${d}`))
    const { review: r } = review([...coffees, tx('courses', 2000, 'Amazon'), tx('loisirs', 3000, 'amazon')])
    const kinds = r.tips.map((t) => t.kind + ('group' in t ? `:${t.group.name}` : ''))
    expect(kinds).toContain('small:Café')
    expect(kinds).toContain('subcategory:Café')
    expect(kinds).toContain('scattered:Amazon')
    expect(kinds).not.toContain('subcategory:Amazon')
  })

  it('ne propose pas une sous-catégorie qui existe déjà', () => {
    const sub: Subcategory = { id: 's', categoryId: 'sorties', name: 'café', emoji: '', order: 0, budget: null, archived: false }
    const coffees = [1, 2, 3].map(() => tx('sorties', 350, 'Café'))
    const { review: r } = review(coffees, [sub])
    expect(r.tips.some((t) => t.kind === 'subcategory')).toBe(false)
  })

  it('totalise par jour et liste les plus grosses dépenses', () => {
    const { review: r } = review([tx('courses', 5000, 'A', '2026-10-01'), tx('courses', 2000, 'B', '2026-10-01'), tx('sorties', 9000, 'C', '2026-10-31')])
    expect(r.daily).toHaveLength(31)
    expect(r.daily[0]).toBe(7000)
    expect(r.daily[30]).toBe(9000)
    expect(r.biggest.map((t) => t.label)).toEqual(['C', 'A', 'B'])
  })

  it('épargne réelle : l’écart devient un poste « Non suivi » et une piste en tête', () => {
    const list = [tx('courses', 30000, 'Carrefour'), tx('sorties', 8000, 'Bar')]
    // Calculée : 2500 − 1000 − 380 = 1120 € ; réelle : 1000 € → 120 € non suivis
    const stats = computeStats({ ...month, actualSavings: 100000 }, cats, list, '2026-11-04')
    expect(stats.projectedSavings).toBe(100000)
    expect(stats.untracked).toBe(12000)
    const r = buildReview(stats, list, cats)
    expect(r.groups.map((g) => [g.key === UNTRACKED ? 'non-suivi' : g.name, g.total])).toEqual([
      ['Carrefour', 30000],
      ['non-suivi', 12000],
      ['Bar', 8000],
    ])
    expect(r.groups[0].share).toBeCloseTo(30000 / 50000)
    expect(r.tips[0]).toEqual({ kind: 'untracked', amount: 12000, share: 12000 / 50000 })
  })

  it('épargne réelle supérieure au calcul : piste « rentrée non notée »', () => {
    const list = [tx('courses', 30000)]
    const stats = computeStats({ ...month, actualSavings: 130000 }, cats, list, '2026-11-04')
    expect(stats.untracked).toBe(-10000)
    const r = buildReview(stats, list, cats)
    expect(r.tips[0]).toEqual({ kind: 'surplus', amount: 10000 })
    expect(r.groups.some((g) => g.key === UNTRACKED)).toBe(false)
  })

  it('l’épargne réelle est ignorée sur le mois en cours', () => {
    const stats = computeStats({ ...month, actualSavings: 1 }, cats, [], '2026-10-15')
    expect(stats.actualSavings).toBeNull()
    expect(stats.untracked).toBe(0)
  })
})

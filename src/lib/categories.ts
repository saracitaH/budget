import type { Category } from './db'

interface DefaultCategory {
  id: string
  name: string
  emoji: string
  color: string
  /** Part du disponible proposée par défaut, en % */
  weight: number
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { id: 'courses', name: 'Courses', emoji: '🛒', color: '#2f9e44', weight: 30 },
  { id: 'sorties', name: 'Sorties', emoji: '🍽️', color: '#e8590c', weight: 15 },
  { id: 'shopping', name: 'Shopping', emoji: '🛍️', color: '#d6336c', weight: 12 },
  { id: 'transport', name: 'Transport', emoji: '🚆', color: '#1c7ed6', weight: 12 },
  { id: 'maison', name: 'Maison', emoji: '🏠', color: '#a0522d', weight: 8 },
  { id: 'loisirs', name: 'Loisirs', emoji: '🎬', color: '#7048e8', weight: 8 },
  { id: 'sante', name: 'Santé', emoji: '💊', color: '#0c8599', weight: 5 },
  { id: 'cadeaux', name: 'Cadeaux', emoji: '🎁', color: '#c2255c', weight: 5 },
  { id: 'divers', name: 'Divers', emoji: '📦', color: '#868e96', weight: 5 },
]

/** Sous-catégories créées au premier lancement, par catégorie par défaut */
export const DEFAULT_SUBCATEGORIES: Record<string, { name: string; emoji: string }[]> = {
  sorties: [
    { name: 'Bar', emoji: '🍺' },
    { name: 'Resto', emoji: '🍝' },
    { name: 'Activités', emoji: '🎳' },
  ],
}

const EXTRA_COLORS = ['#5c940d', '#ae3ec9', '#f08c00', '#1098ad', '#e03131', '#4263eb', '#d9480f', '#495057']

/** Couleur pour une catégorie ajoutée, à partir du nombre de catégories existantes */
export function nextColor(count: number): string {
  return EXTRA_COLORS[count % EXTRA_COLORS.length]
}

export function defaultCategories(): Category[] {
  return DEFAULT_CATEGORIES.map(({ weight: _w, ...c }, i) => ({ ...c, order: i, budget: 0, archived: false }))
}

const STEP = 500 // arrondi des propositions à 5 €

/**
 * Répartit le disponible selon les pondérations par défaut, arrondi à 5 € inférieurs.
 * Le petit reste d'arrondi n'est pas réparti : il s'ajoute naturellement à l'épargne.
 */
export function proposeBudgets(available: number, categories: Pick<Category, 'id'>[]): Record<string, number> {
  const weights = categories.map((c) => DEFAULT_CATEGORIES.find((d) => d.id === c.id)?.weight ?? 5)
  const total = weights.reduce((a, b) => a + b, 0)
  const result: Record<string, number> = {}
  categories.forEach((c, i) => {
    const raw = available > 0 ? (available * weights[i]) / total : 0
    result[c.id] = Math.floor(raw / STEP) * STEP
  })
  return result
}

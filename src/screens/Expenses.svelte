<script lang="ts">
  import EditSheet from '../components/EditSheet.svelte'
  import { dayLabel, monthLabel } from '../lib/dates'
  import { EXTRA_INCOME, EXTRA_INCOME_LABEL, type Category, type Subcategory, type Transaction } from '../lib/db'
  import { formatEUR } from '../lib/money'

  let {
    transactions,
    categories,
    subcategories,
    today,
    monthId,
  }: {
    transactions: Transaction[]
    categories: Category[]
    subcategories: Subcategory[]
    today: string
    monthId: string
  } = $props()

  let filter = $state<string | null>(null)
  let editing = $state<Transaction | null>(null)

  const byId = $derived(new Map(categories.map((c) => [c.id, c])))
  const subById = $derived(new Map(subcategories.map((s) => [s.id, s])))

  const isExtra = (t: Transaction) => t.categoryId === EXTRA_INCOME
  /** Argent qui rentre : remboursement (montant négatif) ou rentrée exceptionnelle */
  const isIncoming = (t: Transaction) => isExtra(t) || t.amount < 0

  /** « Sorties › Bar », ou « Sorties » */
  function catPath(t: Transaction): string {
    if (isExtra(t)) return EXTRA_INCOME_LABEL.name
    const name = byId.get(t.categoryId)?.name ?? 'Sans catégorie'
    const sub = t.subcategoryId ? subById.get(t.subcategoryId) : undefined
    return sub ? `${name} › ${sub.name}` : name
  }
  const visible = $derived(filter ? transactions.filter((t) => t.categoryId === filter) : transactions)
  // Total des dépenses nettes (remboursements déduits) ; les rentrées exceptionnelles sont à part
  const spent = (list: Transaction[]) => list.filter((t) => !isExtra(t)).reduce((s, t) => s + t.amount, 0)
  const total = $derived(spent(visible))
  const extraTotal = $derived(visible.filter(isExtra).reduce((s, t) => s + t.amount, 0))
  const hasExtra = $derived(transactions.some(isExtra))

  /** Montant affiché : « 12 € » pour une dépense, « +20 € » pour de l'argent qui rentre */
  function shown(t: Transaction): string {
    return isIncoming(t) ? `+${formatEUR(Math.abs(t.amount))}` : formatEUR(t.amount)
  }

  const days = $derived.by(() => {
    const groups = new Map<string, Transaction[]>()
    const sorted = [...visible].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    for (const t of sorted) {
      const list = groups.get(t.date) ?? []
      list.push(t)
      groups.set(t.date, list)
    }
    return [...groups].map(([date, items]) => ({ date, items, total: spent(items) }))
  })
</script>

<section class="expenses">
  <header>
    <h1>Dépenses</h1>
    {#if filter !== EXTRA_INCOME}<span class="total">{formatEUR(total)}</span>{/if}
  </header>
  <p class="month">
    {monthLabel(monthId)}
    {#if extraTotal > 0}· <span class="in">+{formatEUR(extraTotal)} de rentrées</span>{/if}
  </p>

  <div class="filters" role="radiogroup" aria-label="Filtrer par catégorie">
    <button type="button" role="radio" aria-checked={filter === null} class:on={filter === null} onclick={() => (filter = null)}>
      Tout
    </button>
    {#each categories as c (c.id)}
      <button type="button" role="radio" aria-checked={filter === c.id} class:on={filter === c.id} onclick={() => (filter = c.id)}>
        {c.emoji} {c.name}
      </button>
    {/each}
    {#if hasExtra}
      <button
        type="button"
        role="radio"
        aria-checked={filter === EXTRA_INCOME}
        class:on={filter === EXTRA_INCOME}
        onclick={() => (filter = EXTRA_INCOME)}
      >
        {EXTRA_INCOME_LABEL.emoji} Rentrées
      </button>
    {/if}
  </div>

  {#if days.length === 0}
    <p class="empty">Aucune dépense {filter ? 'dans cette catégorie ' : ''}ce mois-ci.</p>
  {/if}

  {#each days as day (day.date)}
    <div class="day">
      <div class="dayhead">
        <span>{dayLabel(day.date, today)}</span>
        <span>{day.total !== 0 ? formatEUR(day.total) : ''}</span>
      </div>
      <ul>
        {#each day.items as t (t.id)}
          {@const c = byId.get(t.categoryId)}
          <li>
            <button type="button" onclick={() => (editing = t)}>
              <span class="emoji" aria-hidden="true">{isExtra(t) ? EXTRA_INCOME_LABEL.emoji : (c?.emoji ?? '❔')}</span>
              <span class="what">
                <span class="title">{t.label ?? catPath(t)}</span>
                {#if t.label || (t.amount < 0 && !isExtra(t))}
                  <span class="cat">{t.label ? catPath(t) : ''}{t.amount < 0 ? `${t.label ? ' · ' : ''}remboursement` : ''}</span>
                {/if}
              </span>
              <span class="amt" class:in={isIncoming(t)}>{shown(t)}</span>
            </button>
          </li>
        {/each}
      </ul>
    </div>
  {/each}
</section>

{#if editing}
  <EditSheet tx={editing} {categories} {subcategories} onclose={() => (editing = null)} />
{/if}

<style>
  .expenses {
    padding: 8px 16px 24px;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  h1 {
    margin: 0;
    font-size: 1.6rem;
    letter-spacing: -0.02em;
  }
  .total {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .month {
    margin: 0 0 12px;
    color: var(--muted);
  }
  .filters {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    margin: 0 -16px 8px;
    padding: 0 16px 4px;
    scrollbar-width: none;
  }
  .filters::-webkit-scrollbar {
    display: none;
  }
  .filters button {
    flex-shrink: 0;
    padding: 7px 12px;
    border-radius: 999px;
    background: var(--field);
    color: var(--text);
    font-size: 0.85rem;
  }
  .filters button.on {
    background: var(--accent);
    color: var(--on-accent);
  }
  .empty {
    color: var(--muted);
    text-align: center;
    margin-top: 40px;
  }
  .day {
    margin-top: 12px;
  }
  .dayhead {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    color: var(--muted);
    padding: 0 4px 6px;
    font-variant-numeric: tabular-nums;
  }
  .dayhead span:first-child::first-letter {
    text-transform: uppercase;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    background: var(--surface);
    border-radius: 14px;
    overflow: hidden;
  }
  li + li {
    border-top: 1px solid var(--line);
  }
  li button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: none;
    color: var(--text);
    text-align: left;
  }
  li button:active {
    background: var(--field);
  }
  .emoji {
    font-size: 1.3rem;
  }
  .what {
    flex: 1;
    display: grid;
    min-width: 0;
  }
  .title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cat {
    font-size: 0.8rem;
    color: var(--muted);
  }
  .in {
    color: var(--ok);
  }
  .amt {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
</style>

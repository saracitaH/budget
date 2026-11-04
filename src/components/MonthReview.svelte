<script lang="ts">
  import type { MonthStats } from '../lib/budget'
  import { parseISO } from '../lib/dates'
  import { subcategoryFromLabel, type Category, type Subcategory, type Transaction } from '../lib/db'
  import { formatEUR, formatEURRounded } from '../lib/money'
  import { buildReview, UNTRACKED, type LabelGroup } from '../lib/review'
  import { showToast } from '../lib/toast.svelte'
  import Gauge from './Gauge.svelte'

  let {
    stats,
    transactions,
    categories,
    subcategories,
  }: {
    stats: MonthStats
    transactions: Transaction[]
    categories: Category[]
    subcategories: Subcategory[]
  } = $props()

  const review = $derived(buildReview(stats, transactions, categories, subcategories))
  const catById = $derived(new Map(categories.map((c) => [c.id, c])))
  const emoji = (id: string) => catById.get(id)?.emoji ?? '❔'
  const name = (id: string) => catById.get(id)?.name ?? 'Autre'

  // ── Indicateurs ──
  const used = $derived(stats.totalBudget > 0 ? stats.totalSpent / stats.totalBudget : 0)
  const usedTone = $derived(used > 1 ? 'over' : used >= 0.95 ? 'warn' : 'ok')
  const usedStatus = $derived(used > 1 ? 'Budget dépassé' : used >= 0.95 ? 'Tout juste' : 'Budget respecté')
  const saved = $derived(stats.savingsGoal > 0 ? stats.projectedSavings / stats.savingsGoal : stats.projectedSavings >= 0 ? 1 : 0)
  const savedTone = $derived(saved >= 1 ? 'ok' : saved >= 0.8 ? 'warn' : 'over')
  const savedStatus = $derived(saved >= 1 ? 'Objectif atteint' : saved >= 0.8 ? 'Presque' : 'Objectif manqué')

  // ── Postes de dépense ──
  let showAll = $state(false)
  const positive = $derived(review.groups.filter((g) => g.total > 0))
  const shownGroups = $derived(showAll ? positive : positive.slice(0, 6))
  const maxGroup = $derived(Math.max(1, ...positive.map((g) => g.total)))

  // ── Histogramme par jour ──
  const maxDay = $derived(Math.max(1, ...review.daily))
  const average = $derived(stats.totalSpent / review.daily.length)
  let picked = $state<number | null>(null)
  const pickedDay = $derived(picked ?? review.daily.indexOf(Math.max(...review.daily)))
  const dayIso = (i: number) => `${stats.monthId}-${String(i + 1).padStart(2, '0')}`
  const fmtWeekday = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const fmtShort = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
  const dayName = (i: number) => fmtWeekday.format(parseISO(dayIso(i)))
  const AXIS = $derived([1, 8, 15, 22, review.daily.length])

  async function makeSub(g: LabelGroup) {
    await subcategoryFromLabel(g.categoryId, g.name, g.txIds)
    showToast({ message: `Sous-catégorie « ${g.name} » créée`, detail: `dans ${name(g.categoryId)}, avec ses ${g.count} dépenses`, tone: 'ok' })
  }

  const created = $state<Record<string, boolean>>({})
  let allTips = $state(false)
  const TIPS_SHOWN = 7
  const shownTips = $derived(allTips ? review.tips : review.tips.slice(0, TIPS_SHOWN))
</script>

<div class="card indicators">
  <Gauge
    label="Budget utilisé"
    value={used}
    tone={usedTone}
    status={usedStatus}
    caption={`${formatEURRounded(stats.totalSpent)} / ${formatEURRounded(stats.totalBudget)}`}
  />
  <Gauge
    label="Objectif d'épargne"
    value={saved}
    tone={savedTone}
    status={savedStatus}
    caption={`${formatEURRounded(stats.projectedSavings)} / ${formatEURRounded(stats.savingsGoal)}`}
  />
</div>

{#if review.groups.length === 0}
  <div class="card"><p class="empty">Aucune dépense ce mois-là : rien à analyser.</p></div>
{:else}
  <div class="card">
    <h2>Où est parti ton argent</h2>
    <p class="hint">Regroupé par libellé : « Carrefour » et « carrefour » comptent ensemble.</p>
    <ul class="groups">
      {#each shownGroups as g (g.key)}
        <li>
          <div class="ghead">
            <span class="gname" class:muted={!g.labelled}>{emoji(g.categoryId)} {g.name}</span>
            <b>{formatEURRounded(g.total)}</b>
          </div>
          <div class="hbar" aria-hidden="true"><div style:width="{(g.total / maxGroup) * 100}%"></div></div>
          <div class="gfoot">
            <span>
              {#if g.key === UNTRACKED}écart avec ton épargne réelle{:else}{g.count}×{g.labelled ? ` · ${g.categoryIds.map(name).join(', ')}` : ''}{/if}
            </span>
            <span>{Math.round(g.share * 100)} %</span>
          </div>
        </li>
      {/each}
    </ul>
    {#if positive.length > 6}
      <button type="button" class="more" onclick={() => (showAll = !showAll)}>
        {showAll ? 'Voir moins' : `Voir les ${positive.length} postes`}
      </button>
    {/if}
    {#if review.labelledShare < 0.6}
      <p class="hint">
        {Math.round(review.labelledShare * 100)} % de tes dépenses ont un libellé. Plus tu en mets à la saisie, plus ce
        bilan est précis.
      </p>
    {/if}
  </div>

  <div class="card">
    <h2>Dépenses jour par jour</h2>
    <p class="daypick">
      <span>{dayName(pickedDay)}</span>
      <b>{formatEURRounded(review.daily[pickedDay])}</b>
    </p>
    <div class="histo" role="group" aria-label="Dépenses par jour">
      <div class="avg" style:bottom="{Math.min(1, average / maxDay) * 100}%" aria-hidden="true">
        <span>moy. {formatEURRounded(average)}</span>
      </div>
      {#each review.daily as v, i (i)}
        <button
          type="button"
          class:on={i === pickedDay}
          aria-label={`${dayName(i)} : ${formatEUR(v)}`}
          aria-pressed={i === pickedDay}
          onclick={() => (picked = i)}
        >
          <i style:height="{(Math.max(0, v) / maxDay) * 100}%" class:zero={v <= 0}></i>
        </button>
      {/each}
    </div>
    <div class="axis" aria-hidden="true">
      {#each AXIS as d (d)}
        <span style:left="{((d - 0.5) / review.daily.length) * 100}%">{d}</span>
      {/each}
    </div>
  </div>

  {#if review.biggest.length}
    <div class="card">
      <h2>Plus grosses dépenses</h2>
      <ol class="biggest">
        {#each review.biggest as t (t.id)}
          <li>
            <span class="emoji" aria-hidden="true">{emoji(t.categoryId)}</span>
            <span class="what">
              <span>{t.label ?? name(t.categoryId)}</span>
              <small>{fmtShort.format(parseISO(t.date))}{t.label ? ` · ${name(t.categoryId)}` : ''}</small>
            </span>
            <b>{formatEUR(t.amount)}</b>
          </li>
        {/each}
      </ol>
    </div>
  {/if}

  <div class="card">
    <h2>Pistes pour le mois prochain</h2>
    {#if review.possibleCut > 0}
      <p class="lead">
        Jusqu'à <b>{formatEURRounded(review.possibleCut)}</b> à récupérer sur les catégories peu utilisées : de quoi
        financer une nouvelle charge (assurance, essence…) sans toucher à ton épargne. À ajuster dans
        <b>Réglages › Répartition</b>.
      </p>
    {/if}
    {#if review.tips.length === 0}
      <p class="hint">Rien à signaler : ce mois-ci, tes budgets collaient à tes dépenses. 👏</p>
    {/if}
    <ul class="tips">
      {#each shownTips as tip, i (i)}
        <li class={tip.kind}>
          {#if tip.kind === 'untracked'}
            <span class="ico" aria-hidden="true">🔍</span>
            <p>
              <b>{formatEURRounded(tip.amount)}</b> sont partis sans être notés, soit {Math.round(tip.share * 100)} % de tes
              dépenses réelles. Pense aux petits paiements, aux retraits et aux prélèvements qui varient.
            </p>
          {:else if tip.kind === 'surplus'}
            <span class="ico" aria-hidden="true">🔍</span>
            <p>
              Tu as épargné <b>{formatEURRounded(tip.amount)}</b> de plus que ce que disent tes saisies : une rentrée
              non notée, ou une dépense comptée deux fois ?
            </p>
          {:else if tip.kind === 'over'}
            <span class="ico" aria-hidden="true">⚠️</span>
            <p>
              <b>{emoji(tip.categoryId)} {name(tip.categoryId)}</b> : {formatEURRounded(tip.amount)} au-dessus du budget.
              Prévois plus large, ou surveille-la en priorité.
            </p>
          {:else if tip.kind === 'slack'}
            <span class="ico" aria-hidden="true">💡</span>
            <p>
              <b>{emoji(tip.categoryId)} {name(tip.categoryId)}</b> : {formatEURRounded(tip.spent)} dépensés sur
              {formatEURRounded(tip.budget)}. Tu peux baisser ce budget d'environ <b>{formatEURRounded(tip.cut)}</b>.
            </p>
          {:else if tip.kind === 'small'}
            <span class="ico" aria-hidden="true">🪙</span>
            <p>
              <b>« {tip.group.name} »</b> : {tip.group.count} fois, {formatEURRounded(tip.group.total)} au total
              ({formatEUR(Math.round(tip.average))} en moyenne). Ces petites dépenses s'additionnent : en divisant par
              deux, tu gardes ~{formatEURRounded(tip.saving)} par mois.
            </p>
          {:else if tip.kind === 'scattered'}
            <span class="ico" aria-hidden="true">🔀</span>
            <p>
              <b>« {tip.group.name} »</b> est rangé dans {tip.group.categoryIds.map(name).join(' et ')}. Une seule
              catégorie rendrait le suivi plus clair.
            </p>
          {:else if tip.kind === 'subcategory'}
            <span class="ico" aria-hidden="true">🏷️</span>
            <div>
              <p>
                <b>« {tip.group.name} »</b> revient {tip.group.count} fois dans {name(tip.group.categoryId)}
                ({formatEURRounded(tip.group.total)}). En faire une sous-catégorie pour la suivre à part ?
              </p>
              {#if created[tip.group.key]}
                <span class="done">✓ Créée</span>
              {:else}
                <button
                  type="button"
                  class="action"
                  onclick={async () => {
                    await makeSub(tip.group)
                    created[tip.group.key] = true
                  }}>Créer « {tip.group.name} »</button
                >
              {/if}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
    {#if review.tips.length > TIPS_SHOWN}
      <button type="button" class="more" onclick={() => (allTips = !allTips)}>
        {allTips ? 'Voir moins' : `Voir les ${review.tips.length} pistes`}
      </button>
    {/if}
  </div>
{/if}

<style>
  .card {
    background: var(--surface);
    border-radius: 16px;
    padding: 16px;
  }
  .card h2 {
    margin: 0 0 4px;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
  }
  .hint,
  .empty {
    margin: 4px 0 0;
    font-size: 0.8rem;
    color: var(--muted);
  }
  .empty {
    text-align: center;
    font-size: 0.9rem;
  }
  .indicators {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  /* Postes */
  .groups {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
    display: grid;
    gap: 12px;
  }
  .ghead,
  .gfoot {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-variant-numeric: tabular-nums;
  }
  .gname {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }
  .gname.muted {
    font-weight: 400;
    color: var(--muted);
  }
  .gfoot {
    font-size: 0.8rem;
    color: var(--muted);
  }
  .hbar {
    height: 8px;
    margin: 4px 0 3px;
  }
  .hbar div {
    height: 100%;
    min-width: 4px;
    border-radius: 0 4px 4px 0;
    background: var(--accent);
  }
  .more {
    margin-top: 12px;
    padding: 8px 12px;
    border-radius: 10px;
    background: var(--field);
    color: var(--text);
    font-size: 0.85rem;
  }

  /* Histogramme */
  .daypick {
    display: flex;
    justify-content: space-between;
    margin: 4px 0 8px;
    font-variant-numeric: tabular-nums;
  }
  .daypick span::first-letter {
    text-transform: uppercase;
  }
  .histo {
    position: relative;
    display: flex;
    align-items: stretch;
    gap: 2px;
    height: 120px;
    border-bottom: 1px solid var(--line);
  }
  .histo button {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: flex-end;
    padding: 0;
    background: none;
  }
  .histo i {
    display: block;
    width: 100%;
    min-height: 2px;
    border-radius: 4px 4px 0 0;
    background: var(--accent);
    opacity: 0.45;
  }
  .histo i.zero {
    background: var(--track);
    opacity: 1;
  }
  .histo button.on i {
    opacity: 1;
  }
  .avg {
    position: absolute;
    left: 0;
    right: 0;
    border-top: 1px dashed var(--muted);
    pointer-events: none;
  }
  .avg span {
    position: absolute;
    right: 0;
    bottom: 2px;
    padding: 0 4px;
    border-radius: 4px;
    background: var(--surface);
    font-size: 0.7rem;
    color: var(--muted);
  }
  .axis {
    position: relative;
    height: 16px;
    font-size: 0.7rem;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .axis span {
    position: absolute;
    top: 2px;
    transform: translateX(-50%);
  }

  /* Plus grosses dépenses */
  .biggest {
    list-style: none;
    margin: 4px 0 0;
    padding: 0;
  }
  .biggest li {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
  }
  .biggest li + li {
    border-top: 1px solid var(--line);
  }
  .biggest .emoji {
    font-size: 1.2rem;
  }
  .biggest .what {
    flex: 1;
    display: grid;
    min-width: 0;
  }
  .biggest .what span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .biggest small {
    color: var(--muted);
  }
  .biggest b {
    font-variant-numeric: tabular-nums;
  }

  /* Pistes */
  .lead {
    margin: 8px 0 4px;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--accent-soft);
    font-size: 0.9rem;
  }
  .tips {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
    display: grid;
    gap: 10px;
  }
  .tips li {
    display: flex;
    gap: 10px;
    font-size: 0.9rem;
  }
  .tips p {
    margin: 0;
  }
  .ico {
    flex-shrink: 0;
  }
  .action {
    margin-top: 6px;
    padding: 7px 12px;
    border-radius: 999px;
    background: var(--accent);
    color: var(--on-accent);
    font-size: 0.85rem;
    font-weight: 600;
  }
  .done {
    display: inline-block;
    margin-top: 6px;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--ok);
  }
</style>

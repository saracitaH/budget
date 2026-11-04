<script lang="ts">
  import CategoryBar from '../components/CategoryBar.svelte'
  import MonthNav from '../components/MonthNav.svelte'
  import MonthReview from '../components/MonthReview.svelte'
  import type { MonthStats } from '../lib/budget'
  import { monthLabel } from '../lib/dates'
  import type { Category, Subcategory, Transaction } from '../lib/db'
  import { formatEURRounded } from '../lib/money'

  let {
    stats,
    transactions,
    categories,
    subcategories,
    months,
    onmonth,
    backupDue,
    onbackup,
  }: {
    stats: MonthStats
    transactions: Transaction[]
    categories: Category[]
    subcategories: Subcategory[]
    /** Mois consultables, du plus ancien au plus récent */
    months: string[]
    onmonth: (id: string) => void
    /** Texte du rappel de sauvegarde, ou null */
    backupDue: string | null
    onbackup: () => void
  } = $props()

  // Mois en cours : on propose d'aller voir le bilan du mois précédent s'il existe
  const previous = $derived.by(() => {
    if (stats.finished) return null
    const i = months.indexOf(stats.monthId)
    return i > 0 ? months[i - 1] : null
  })

  const PACE_TEXT = {
    ok: 'Tu es dans le rythme.',
    pace: 'Tu dépenses plus vite que prévu.',
    warn: 'Plus de 80 % du budget est déjà utilisé.',
    over: 'Le budget du mois est dépassé.',
  }

  const gap = $derived(stats.projectedSavings - stats.savingsGoal)
</script>

<section class="dash">
  <header>
    <MonthNav monthId={stats.monthId} {months} {onmonth} />
    <span class="day">{stats.finished ? 'Terminé' : `Jour ${stats.day} / ${stats.daysInMonth}`}</span>
  </header>

  {#if backupDue}
    <div class="banner">
      <span>{backupDue}</span>
      <button type="button" onclick={onbackup}>Sauvegarder</button>
    </div>
  {/if}

  {#if previous}
    <button type="button" class="card recap" onclick={() => onmonth(previous)}>
      <span>📊 Le bilan de <b>{monthLabel(previous)}</b> est prêt</span>
      <span aria-hidden="true">›</span>
    </button>
  {/if}

  {#if stats.finished}
    <div class="card hero">
      <span class="kicker">Dépensé ce mois-là</span>
      <span class="big">{formatEURRounded(stats.totalSpent)}</span>
      <span class="sub">sur un budget de <b>{formatEURRounded(stats.totalBudget)}</b></span>
      {#if stats.remaining >= 0}
        <span class="rhythm ok">{formatEURRounded(stats.remaining)} non dépensés, partis à l'épargne.</span>
      {:else}
        <span class="rhythm over">Budget dépassé de {formatEURRounded(-stats.remaining)}.</span>
      {/if}
    </div>
  {:else}
  <div class="card hero">
    <span class="kicker">Reste à dépenser</span>
    <span class="big" class:neg={stats.remaining < 0}>{formatEURRounded(stats.remaining)}</span>
    {#if stats.remaining > 0 && stats.day > 0}
      <span class="sub">
        soit <b>{formatEURRounded(stats.perDay)} par jour</b> pendant {stats.daysLeft}
        {stats.daysLeft > 1 ? 'jours' : 'jour'}
      </span>
    {/if}
    <span class="rhythm {stats.status}">{PACE_TEXT[stats.status]}</span>
  </div>
  {/if}

  <div class="card savings">
    <div>
      <span class="kicker">{stats.finished ? 'Épargne réalisée' : 'Épargne prévue'}</span>
      <span class="mid">{formatEURRounded(stats.projectedSavings)}</span>
      <span class="sub">objectif {formatEURRounded(stats.savingsGoal)}</span>
      {#if stats.extraIncome > 0}
        <span class="sub">dont <b class="in">+{formatEURRounded(stats.extraIncome)}</b> de rentrées</span>
      {/if}
    </div>
    {#if stats.onTrack}
      <span class="badge ok">Dans les clous{gap >= 500 ? ` · +${formatEURRounded(gap)}` : ''}</span>
    {:else}
      <span class="badge over">Il manque {formatEURRounded(-gap)}</span>
    {/if}
  </div>

  {#if stats.finished}
    <MonthReview {stats} {transactions} {categories} {subcategories} />
  {/if}

  <div class="card">
    <h2>Par catégorie</h2>
    {#each stats.categories as stat (stat.category.id)}
      <CategoryBar {stat} elapsed={stats.elapsed} />
    {/each}
    {#if !stats.finished}
      <p class="legend">Le trait vertical indique où tu devrais en être aujourd'hui pour finir le mois pile dans le budget.</p>
    {/if}
  </div>
</section>

<style>
  .dash {
    display: grid;
    gap: 12px;
    padding: 8px 16px 24px;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  header {
    gap: 8px;
  }
  .day {
    flex-shrink: 0;
    color: var(--muted);
    font-size: 0.9rem;
  }
  .recap {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: var(--accent-soft);
    color: var(--text);
    text-align: left;
  }
  .recap span:last-child {
    font-size: 1.4rem;
    line-height: 1;
    color: var(--accent-text);
  }
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
  .kicker {
    display: block;
    font-size: 0.8rem;
    color: var(--muted);
  }
  .hero {
    display: grid;
    gap: 2px;
  }
  .big {
    font-size: 2.8rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }
  .big.neg {
    color: var(--danger);
  }
  .sub {
    color: var(--muted);
  }
  .sub b {
    color: var(--text);
  }
  .sub b.in {
    color: var(--ok);
  }
  .rhythm {
    margin-top: 6px;
    font-weight: 600;
    color: var(--ok);
  }
  .rhythm.pace,
  .rhythm.warn {
    color: var(--warn);
  }
  .rhythm.over {
    color: var(--danger);
  }
  .savings {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  .savings > div {
    display: grid;
  }
  .mid {
    font-size: 1.6rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .badge {
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 0.85rem;
    font-weight: 600;
    text-align: center;
  }
  .badge.ok {
    background: var(--ok-soft);
    color: var(--ok);
  }
  .badge.over {
    background: var(--danger-soft);
    color: var(--danger);
  }
  .banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 14px;
    background: var(--warn-soft);
    color: var(--text);
    font-size: 0.9rem;
  }
  .banner button {
    flex-shrink: 0;
    padding: 8px 12px;
    border-radius: 10px;
    background: var(--warn);
    color: var(--on-warn);
    font-weight: 600;
  }
  .legend {
    margin: 8px 0 0;
    font-size: 0.8rem;
    color: var(--muted);
  }
</style>

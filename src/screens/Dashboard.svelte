<script lang="ts">
  import CategoryBar from '../components/CategoryBar.svelte'
  import type { MonthStats } from '../lib/budget'
  import { monthLabel } from '../lib/dates'
  import { formatEURRounded } from '../lib/money'

  let {
    stats,
    backupDue,
    onbackup,
  }: {
    stats: MonthStats
    /** Texte du rappel de sauvegarde, ou null */
    backupDue: string | null
    onbackup: () => void
  } = $props()

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
    <h1>{monthLabel(stats.monthId)}</h1>
    <span class="day">Jour {stats.day} / {stats.daysInMonth}</span>
  </header>

  {#if backupDue}
    <div class="banner">
      <span>{backupDue}</span>
      <button type="button" onclick={onbackup}>Sauvegarder</button>
    </div>
  {/if}

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

  <div class="card savings">
    <div>
      <span class="kicker">Épargne prévue</span>
      <span class="mid">{formatEURRounded(stats.projectedSavings)}</span>
      <span class="sub">objectif {formatEURRounded(stats.savingsGoal)}</span>
    </div>
    {#if stats.onTrack}
      <span class="badge ok">Dans les clous{gap >= 500 ? ` · +${formatEURRounded(gap)}` : ''}</span>
    {:else}
      <span class="badge over">Il manque {formatEURRounded(-gap)}</span>
    {/if}
  </div>

  <div class="card">
    <h2>Par catégorie</h2>
    {#each stats.categories as stat (stat.category.id)}
      <CategoryBar {stat} elapsed={stats.elapsed} />
    {/each}
    <p class="legend">Le trait vertical indique où tu devrais en être aujourd'hui pour finir le mois pile dans le budget.</p>
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
    align-items: baseline;
  }
  h1 {
    margin: 0;
    font-size: 1.6rem;
    letter-spacing: -0.02em;
  }
  h1::first-letter {
    text-transform: uppercase;
  }
  .day {
    color: var(--muted);
    font-size: 0.9rem;
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

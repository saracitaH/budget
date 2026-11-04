<script lang="ts">
  // Mois terminé : l'épargne réelle constatée sur le compte, pour mesurer ce qui a échappé au suivi.
  import type { MonthStats } from '../lib/budget'
  import { setActualSavings } from '../lib/db'
  import { formatEURRounded } from '../lib/money'
  import { showToast } from '../lib/toast.svelte'
  import MoneyField from './MoneyField.svelte'

  let { stats }: { stats: MonthStats } = $props()

  let editing = $state(false)
  let value = $state(0)
  /** Épargne calculée à partir des seules saisies */
  const computed = $derived(stats.projectedSavings + stats.untracked)

  function edit() {
    value = stats.actualSavings ?? Math.max(0, computed)
    editing = true
  }

  async function save() {
    await setActualSavings(stats.monthId, value)
    editing = false
    const gap = computed - value
    showToast({
      message: 'Épargne réelle enregistrée',
      detail:
        gap > 0
          ? `${formatEURRounded(gap)} sont partis sans être notés`
          : gap < 0
            ? `${formatEURRounded(-gap)} de mieux que prévu`
            : 'Tes saisies collent pile à ton compte',
      tone: gap > 0 ? 'warn' : 'ok',
    })
  }

  async function clear() {
    await setActualSavings(stats.monthId, null)
    editing = false
  }
</script>

<div class="actual">
  {#if editing}
    <label for="actual-savings">Combien as-tu réellement épargné ce mois-là ?</label>
    <p class="help">Regarde ce qui reste sur ton compte en fin de mois, épargne comprise.</p>
    <div class="field">
      <MoneyField bind:value ariaLabel="Épargne réelle" />
    </div>
    <div class="buttons">
      <button type="button" class="primary" onclick={save}>Enregistrer</button>
      <button type="button" onclick={() => (editing = false)}>Annuler</button>
      {#if stats.actualSavings !== null}
        <button type="button" class="link" onclick={clear}>Effacer</button>
      {/if}
    </div>
  {:else if stats.actualSavings !== null}
    <div class="line">
      <span>Calculée d'après tes saisies</span>
      <b>{formatEURRounded(computed)}</b>
    </div>
    {#if stats.untracked !== 0}
      <div class="line">
        <span>{stats.untracked > 0 ? 'Non suivi' : 'Mieux que prévu'}</span>
        <b class:warn={stats.untracked > 0} class:in={stats.untracked < 0}>
          {stats.untracked > 0 ? '−' : '+'}{formatEURRounded(Math.abs(stats.untracked))}
        </b>
      </div>
    {/if}
    <button type="button" class="link" onclick={edit}>Modifier l'épargne réelle</button>
  {:else}
    <button type="button" class="ask" onclick={edit}>
      <span>Ton compte dit autre chose ? Indique ton épargne réelle</span>
      <span aria-hidden="true">›</span>
    </button>
  {/if}
</div>

<style>
  .actual {
    display: grid;
    gap: 6px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
    font-size: 0.9rem;
  }
  label {
    font-weight: 600;
  }
  .help {
    margin: 0;
    font-size: 0.8rem;
    color: var(--muted);
  }
  .field {
    max-width: 180px;
  }
  .buttons {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }
  .buttons button {
    padding: 8px 14px;
    border-radius: 10px;
    background: var(--field);
    color: var(--text);
    font-weight: 600;
  }
  .buttons .primary {
    background: var(--accent);
    color: var(--on-accent);
  }
  .line {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .line b {
    color: var(--text);
  }
  .line b.warn {
    color: var(--warn);
  }
  .line b.in {
    color: var(--ok);
  }
  button.link,
  .buttons button.link {
    justify-self: start;
    padding: 4px 0;
    background: none;
    color: var(--accent-text);
    font-weight: 600;
  }
  .ask {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 0;
    background: none;
    color: var(--accent-text);
    font-weight: 600;
    text-align: left;
  }
  .ask span:last-child {
    font-size: 1.3rem;
    line-height: 1;
  }
</style>

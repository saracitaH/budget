<script lang="ts">
  import { proposeBudgets } from '../lib/categories'
  import type { Category } from '../lib/db'
  import { formatEUR } from '../lib/money'
  import MoneyField from './MoneyField.svelte'

  let {
    categories,
    budgets = $bindable({}),
    available,
    onchange,
  }: {
    categories: Category[]
    budgets?: Record<string, number>
    /** Revenus − charges fixes − épargne */
    available: number
    onchange?: () => void
  } = $props()

  const allocated = $derived(categories.reduce((s, c) => s + (budgets[c.id] ?? 0), 0))
  const unallocated = $derived(available - allocated)

  function propose() {
    budgets = proposeBudgets(available, categories)
    onchange?.()
  }
</script>

<div class="summary">
  <div><span>Disponible</span><b>{formatEUR(available)}</b></div>
  <div><span>Réparti</span><b>{formatEUR(allocated)}</b></div>
</div>

{#if available <= 0}
  <p class="note over">
    Tes charges fixes et ton épargne dépassent tes revenus : il ne reste rien à répartir. Revois l'objectif d'épargne
    ou les charges.
  </p>
{:else if unallocated > 0}
  <p class="note">{formatEUR(unallocated)} non répartis : ils s'ajouteront à ton épargne.</p>
{:else if unallocated < 0}
  <p class="note over">
    Tu as réparti {formatEUR(-unallocated)} de plus que le disponible : ton épargne sera plus faible que l'objectif.
  </p>
{/if}

<button type="button" class="propose" onclick={propose} disabled={available <= 0}>Proposer une répartition</button>

<div class="list">
  {#each categories as c (c.id)}
    <div class="row">
      <span class="name"><span class="emoji" aria-hidden="true">{c.emoji}</span>{c.name}</span>
      <MoneyField bind:value={budgets[c.id]} ariaLabel={`Budget ${c.name}`} onchange={() => onchange?.()} />
    </div>
  {/each}
</div>

<style>
  .summary {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .summary div {
    background: var(--field);
    border-radius: 12px;
    padding: 10px 12px;
    display: grid;
  }
  .summary span {
    font-size: 0.8rem;
    color: var(--muted);
  }
  .summary b {
    font-size: 1.15rem;
    font-variant-numeric: tabular-nums;
  }
  .note {
    margin: 10px 0 0;
    font-size: 0.9rem;
    color: var(--muted);
  }
  .note.over {
    color: var(--danger);
  }
  .propose {
    margin: 12px 0;
    width: 100%;
    height: 44px;
    border-radius: 12px;
    background: var(--accent-soft);
    color: var(--accent-text);
    font-weight: 600;
  }
  .propose:disabled {
    opacity: 0.5;
  }
  .list {
    display: grid;
    gap: 6px;
  }
  .row {
    display: grid;
    grid-template-columns: 1fr 130px;
    gap: 8px;
    align-items: center;
  }
  .name {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .emoji {
    width: 1.5em;
    text-align: center;
  }
</style>

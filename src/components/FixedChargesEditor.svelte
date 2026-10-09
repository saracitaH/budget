<script lang="ts">
  import type { FixedChargeInput } from '../lib/db'
  import { newId } from '../lib/db'
  import { formatEUR } from '../lib/money'
  import MoneyField from './MoneyField.svelte'

  let {
    items = $bindable([]),
    onchange,
  }: {
    items?: FixedChargeInput[]
    onchange?: () => void
  } = $props()

  const SUGGESTIONS = ['Loyer', 'Électricité', 'Internet', 'Téléphone', 'Assurances', 'Transport (abonnement)', 'Abonnements']

  const total = $derived(items.reduce((s, i) => s + i.amount, 0))
  const suggestions = $derived(SUGGESTIONS.filter((s) => !items.some((i) => i.label === s)))

  function add(label = '') {
    items = [...items, { id: newId(), label, amount: 0 }]
  }

  function remove(id: string | undefined) {
    items = items.filter((i) => i.id !== id)
    onchange?.()
  }
</script>

<div class="list">
  {#each items as item (item.id)}
    <div class="row">
      <input
        class="label"
        type="text"
        placeholder="Libellé"
        bind:value={item.label}
        onblur={() => onchange?.()}
        aria-label="Libellé de la charge"
      />
      <div class="amount">
        <MoneyField bind:value={item.amount} ariaLabel={`Montant ${item.label}`} onchange={() => onchange?.()} />
      </div>
      <button type="button" class="remove" aria-label={`Supprimer ${item.label}`} onclick={() => remove(item.id)}>
        ×
      </button>
    </div>
  {/each}
</div>

{#if suggestions.length}
  <div class="chips">
    {#each suggestions as s (s)}
      <button type="button" class="chip" onclick={() => add(s)}>+ {s}</button>
    {/each}
    <button type="button" class="chip" onclick={() => add()}>+ Autre</button>
  </div>
{:else}
  <button type="button" class="chip" onclick={() => add()}>+ Ajouter une charge</button>
{/if}

<p class="total">Total des charges fixes : <b>{formatEUR(total)}</b></p>

<style>
  .list {
    display: grid;
    gap: 8px;
  }
  .row {
    display: grid;
    grid-template-columns: 1fr 120px 36px;
    gap: 8px;
    align-items: center;
  }
  .label {
    height: 44px;
    border: none;
    border-radius: 10px;
    background: var(--field);
    color: var(--text);
    padding: 0 12px;
    min-width: 0;
  }
  .amount :global(.money) {
    width: 100%;
  }
  .remove {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: transparent;
    color: var(--muted);
    font-size: 1.4rem;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }
  .chip {
    padding: 8px 12px;
    border-radius: 999px;
    background: var(--field);
    color: var(--text);
    font-size: 0.9rem;
  }
  .total {
    margin: 12px 0 0;
    color: var(--muted);
  }
  .total b {
    color: var(--text);
  }
</style>

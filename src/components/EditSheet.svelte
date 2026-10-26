<script lang="ts">
  import type { Category, Subcategory, Transaction } from '../lib/db'
  import { db, deleteTransaction, EXTRA_INCOME, EXTRA_INCOME_LABEL, updateTransaction } from '../lib/db'
  import { formatEUR } from '../lib/money'
  import { showToast } from '../lib/toast.svelte'
  import MoneyField from './MoneyField.svelte'

  let {
    tx,
    categories,
    subcategories,
    onclose,
  }: {
    tx: Transaction
    categories: Category[]
    subcategories: Subcategory[]
    onclose: () => void
  } = $props()

  // Copie locale : rien n'est enregistré avant « Enregistrer »
  // svelte-ignore state_referenced_locally
  let kind = $state<'expense' | 'income'>(tx.amount < 0 || tx.categoryId === EXTRA_INCOME ? 'income' : 'expense')
  // Montant toujours saisi en positif ; le signe vient de « Dépense / Rentrée »
  // svelte-ignore state_referenced_locally
  let amount = $state(Math.abs(tx.amount))
  // svelte-ignore state_referenced_locally
  let categoryId = $state(tx.categoryId)
  // svelte-ignore state_referenced_locally
  let subcategoryId = $state<string | undefined>(tx.subcategoryId)
  // svelte-ignore state_referenced_locally
  let date = $state(tx.date)
  // svelte-ignore state_referenced_locally
  let label = $state(tx.label ?? '')
  let confirmDelete = $state(false)

  // La sous-catégorie actuelle reste proposée même si elle a été masquée depuis
  const subs = $derived(
    subcategories.filter((s) => s.categoryId === categoryId && (!s.archived || s.id === tx.subcategoryId)),
  )

  const canSave = $derived(amount > 0 && !!date && categoryId !== '')

  function chooseCategory(id: string) {
    if (id !== categoryId) subcategoryId = undefined
    categoryId = id
  }

  function chooseKind(k: 'expense' | 'income') {
    kind = k
    // Une rentrée exceptionnelle n'a pas de sens en dépense : il faut choisir une catégorie
    if (k === 'expense' && categoryId === EXTRA_INCOME) categoryId = ''
  }

  async function save() {
    if (!canSave) return
    const extra = categoryId === EXTRA_INCOME
    // Remboursement dans une catégorie = montant négatif ; rentrée exceptionnelle = positif
    const signed = kind === 'income' && !extra ? -amount : amount
    await updateTransaction(tx.id, { amount: signed, categoryId, subcategoryId: extra ? undefined : subcategoryId, date, label })
    onclose()
  }

  async function remove() {
    if (!confirmDelete) {
      confirmDelete = true
      return
    }
    // Copie avant fermeture : une fois la fiche fermée, la prop tx n'est plus disponible
    const removed = $state.snapshot(tx)
    await deleteTransaction(removed.id)
    onclose()
    showToast({
      message: `${removed.amount < 0 ? '+' : ''}${formatEUR(Math.abs(removed.amount))} supprimé`,
      action: { label: 'Annuler', run: () => db.transactions.put(removed) },
    })
  }
</script>

<div class="backdrop" role="presentation" onclick={onclose}></div>
<div class="sheet" role="dialog" aria-modal="true" aria-label="Modifier la dépense">
  <div class="grab" aria-hidden="true"></div>
  <header>
    <button type="button" class="text" onclick={onclose}>Annuler</button>
    <h2>Modifier</h2>
    <button type="button" class="text strong" onclick={save} disabled={!canSave}>Enregistrer</button>
  </header>

  <div class="kind" role="radiogroup" aria-label="Type">
    <button type="button" role="radio" aria-checked={kind === 'expense'} class:on={kind === 'expense'} onclick={() => chooseKind('expense')}>
      − Dépense
    </button>
    <button type="button" role="radio" aria-checked={kind === 'income'} class:on={kind === 'income'} onclick={() => chooseKind('income')}>
      + Rentrée
    </button>
  </div>

  <div class="fields">
    <div class="amount"><MoneyField bind:value={amount} ariaLabel="Montant" /></div>
    <input class="field" type="text" placeholder="Libellé (facultatif)" bind:value={label} aria-label="Libellé" />
    <input class="field" type="date" bind:value={date} aria-label="Date" />
  </div>

  <div class="cats" role="radiogroup" aria-label="Catégorie">
    {#each categories as c (c.id)}
      <button
        type="button"
        role="radio"
        aria-checked={c.id === categoryId}
        class:selected={c.id === categoryId}
        onclick={() => chooseCategory(c.id)}
      >
        <span aria-hidden="true">{c.emoji}</span>{c.name}
      </button>
    {/each}
    {#if kind === 'income'}
      <button
        type="button"
        role="radio"
        aria-checked={categoryId === EXTRA_INCOME}
        class:selected={categoryId === EXTRA_INCOME}
        onclick={() => chooseCategory(EXTRA_INCOME)}
      >
        <span aria-hidden="true">{EXTRA_INCOME_LABEL.emoji}</span>Rentrée exc.
      </button>
    {/if}
  </div>
  {#if kind === 'income' && categoryId !== EXTRA_INCOME}
    <p class="hint">Remboursement : l'argent revient dans la catégorie choisie.</p>
  {:else if kind === 'expense' && categoryId === ''}
    <p class="hint">Choisis la catégorie de la dépense.</p>
  {/if}

  {#if subs.length}
    <div class="subs" role="radiogroup" aria-label="Sous-catégorie">
      <button
        type="button"
        role="radio"
        aria-checked={!subcategoryId}
        class:selected={!subcategoryId}
        onclick={() => (subcategoryId = undefined)}>Sans précision</button
      >
      {#each subs as s (s.id)}
        <button
          type="button"
          role="radio"
          aria-checked={s.id === subcategoryId}
          class:selected={s.id === subcategoryId}
          onclick={() => (subcategoryId = s.id)}>{s.emoji} {s.name}</button
        >
      {/each}
    </div>
  {/if}

  <button type="button" class="delete" class:confirm={confirmDelete} onclick={remove}>
    {confirmDelete ? 'Confirmer la suppression' : 'Supprimer cette dépense'}
  </button>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.4);
    z-index: 20;
  }
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 21;
    max-width: 560px;
    margin: 0 auto;
    max-height: 92dvh;
    overflow-y: auto;
    background: var(--surface);
    border-radius: 20px 20px 0 0;
    padding: 8px 16px calc(env(safe-area-inset-bottom) + 16px);
    display: grid;
    gap: 16px;
    animation: up 0.2s ease-out;
  }
  @keyframes up {
    from {
      transform: translateY(40px);
      opacity: 0;
    }
  }
  .grab {
    justify-self: center;
    width: 36px;
    height: 5px;
    border-radius: 3px;
    background: var(--line);
  }
  header {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
  }
  h2 {
    margin: 0;
    font-size: 1rem;
  }
  .text {
    background: none;
    color: var(--accent-text);
    padding: 8px 0;
    justify-self: start;
  }
  .text.strong {
    justify-self: end;
    font-weight: 700;
  }
  .text:disabled {
    opacity: 0.4;
  }
  .kind {
    display: grid;
    grid-template-columns: 1fr 1fr;
    background: var(--field);
    border-radius: 10px;
    padding: 3px;
  }
  .kind button {
    height: 34px;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
    font-weight: 600;
  }
  .kind button.on {
    background: var(--surface);
    color: var(--text);
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.12);
  }
  .kind button.on:last-child {
    color: var(--ok);
  }
  .hint {
    margin: -8px 0 0;
    font-size: 0.8rem;
    color: var(--muted);
  }
  .fields {
    display: grid;
    gap: 8px;
  }
  .amount :global(.money) {
    width: 100%;
  }
  .amount :global(input) {
    font-size: 1.6rem;
    height: 56px;
  }
  .field {
    height: 44px;
    border: none;
    border-radius: 10px;
    background: var(--field);
    color: var(--text);
    padding: 0 12px;
    width: 100%;
  }
  .cats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }
  .cats button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px 4px;
    border-radius: 12px;
    background: var(--field);
    color: var(--text);
    font-size: 0.8rem;
  }
  .cats button span {
    font-size: 1.3rem;
  }
  .cats button.selected {
    background: var(--accent);
    color: var(--on-accent);
  }
  .subs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: -6px;
  }
  .subs button {
    padding: 8px 12px;
    border-radius: 999px;
    background: var(--field);
    color: var(--text);
    font-size: 0.85rem;
  }
  .subs button.selected {
    background: var(--accent);
    color: var(--on-accent);
  }
  .delete {
    height: 48px;
    border-radius: 12px;
    background: transparent;
    color: var(--danger);
    font-weight: 600;
  }
  .delete.confirm {
    background: var(--danger);
    color: #fff;
  }
</style>

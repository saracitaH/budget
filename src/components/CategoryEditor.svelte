<script lang="ts">
  import type { Category, Subcategory } from '../lib/db'
  import {
    addCategory,
    addSubcategory,
    moveCategory,
    removeCategory,
    removeSubcategory,
    updateCategory,
    updateSubcategory,
  } from '../lib/db'
  import { formatEUR } from '../lib/money'
  import { showToast } from '../lib/toast.svelte'
  import MoneyField from './MoneyField.svelte'

  let { categories, subcategories }: { categories: Category[]; subcategories: Subcategory[] } = $props()

  let open = $state<string | null>(null)
  let confirmRemove = $state<string | null>(null)
  let newSub = $state({ emoji: '', name: '' })
  let newCat = $state({ emoji: '', name: '' })

  function subsOf(id: string) {
    return subcategories.filter((s) => s.categoryId === id && !s.archived)
  }

  function toggle(id: string) {
    open = open === id ? null : id
    confirmRemove = null
    newSub = { emoji: '', name: '' }
  }

  function rename(c: Category, field: 'name' | 'emoji', value: string) {
    const v = value.trim()
    if (v) updateCategory(c.id, { [field]: v })
  }

  function renameSub(s: Subcategory, field: 'name' | 'emoji', value: string) {
    const v = value.trim()
    if (field === 'name' && !v) return
    updateSubcategory(s.id, { [field]: v })
  }

  async function createSub(categoryId: string) {
    if (!newSub.name.trim()) return
    await addSubcategory(categoryId, newSub)
    newSub = { emoji: '', name: '' }
  }

  async function createCategory() {
    if (!newCat.name.trim()) return
    const c = await addCategory(newCat)
    newCat = { emoji: '', name: '' }
    open = c.id
    showToast({ message: `${c.emoji} ${c.name} ajoutée`, detail: 'Pense à lui donner un budget dans la répartition', tone: 'ok' })
  }

  async function remove(c: Category) {
    if (confirmRemove !== c.id) {
      confirmRemove = c.id
      return
    }
    const result = await removeCategory(c.id)
    open = null
    confirmRemove = null
    showToast({
      message: `${c.name} ${result === 'deleted' ? 'supprimée' : 'masquée'}`,
      detail: result === 'archived' ? 'Ses dépenses passées restent dans l’historique' : undefined,
    })
  }
</script>

<ul class="cats">
  {#each categories as c, i (c.id)}
    {@const subs = subsOf(c.id)}
    {@const subTotal = subs.reduce((t, s) => t + (s.budget ?? 0), 0)}
    <li class:open={open === c.id}>
      <button type="button" class="head" aria-expanded={open === c.id} onclick={() => toggle(c.id)}>
        <span class="emoji" aria-hidden="true">{c.emoji}</span>
        <span class="name">{c.name}</span>
        <span class="count">{subs.length ? `${subs.length} sous-cat.` : ''}</span>
        <svg class="chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>

      {#if open === c.id}
        <div class="body">
          <div class="ident">
            <input
              class="emoji-in"
              type="text"
              value={c.emoji}
              aria-label="Emoji"
              onchange={(e) => rename(c, 'emoji', e.currentTarget.value)}
            />
            <input type="text" value={c.name} aria-label="Nom" onchange={(e) => rename(c, 'name', e.currentTarget.value)} />
            <button type="button" class="icon" aria-label="Monter" disabled={i === 0} onclick={() => moveCategory(c.id, -1)}>↑</button>
            <button
              type="button"
              class="icon"
              aria-label="Descendre"
              disabled={i === categories.length - 1}
              onclick={() => moveCategory(c.id, 1)}>↓</button
            >
          </div>

          <h3>Sous-catégories</h3>
          <p class="hint">Budget facultatif : laisse vide pour partager celui de {c.name} ({formatEUR(c.budget)}).</p>
          {#each subs as s (s.id)}
            <div class="sub">
              <input
                class="emoji-in"
                type="text"
                value={s.emoji}
                aria-label={`Emoji de ${s.name}`}
                onchange={(e) => renameSub(s, 'emoji', e.currentTarget.value)}
              />
              <input
                type="text"
                value={s.name}
                aria-label={`Nom de ${s.name}`}
                onchange={(e) => renameSub(s, 'name', e.currentTarget.value)}
              />
              <MoneyField
                value={s.budget ?? 0}
                placeholder="—"
                ariaLabel={`Budget de ${s.name}`}
                onchange={(v) => updateSubcategory(s.id, { budget: v > 0 ? v : null })}
              />
              <button type="button" class="icon" aria-label={`Supprimer ${s.name}`} onclick={() => removeSubcategory(s.id)}>×</button>
            </div>
          {/each}
          {#if subTotal > c.budget}
            <p class="hint warn">
              Les budgets des sous-catégories ({formatEUR(subTotal)}) dépassent celui de {c.name} ({formatEUR(c.budget)}).
            </p>
          {/if}
          <form class="sub add" onsubmit={(e) => (e.preventDefault(), createSub(c.id))}>
            <input class="emoji-in" type="text" placeholder="🙂" bind:value={newSub.emoji} aria-label="Emoji" />
            <input type="text" placeholder="Nouvelle sous-catégorie" bind:value={newSub.name} aria-label="Nom" />
            <button type="submit" class="add-btn" disabled={!newSub.name.trim()}>Ajouter</button>
          </form>

          <button type="button" class="remove" class:confirm={confirmRemove === c.id} onclick={() => remove(c)}>
            {confirmRemove === c.id ? `Confirmer : retirer ${c.name}` : 'Retirer cette catégorie'}
          </button>
        </div>
      {/if}
    </li>
  {/each}
</ul>

<form class="new" onsubmit={(e) => (e.preventDefault(), createCategory())}>
  <input class="emoji-in" type="text" placeholder="🏷️" bind:value={newCat.emoji} aria-label="Emoji de la nouvelle catégorie" />
  <input type="text" placeholder="Nouvelle catégorie" bind:value={newCat.name} aria-label="Nom de la nouvelle catégorie" />
  <button type="submit" class="add-btn" disabled={!newCat.name.trim()}>Ajouter</button>
</form>

<style>
  .cats {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li + li {
    border-top: 1px solid var(--line);
  }
  .head {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 0;
    background: none;
    color: var(--text);
    text-align: left;
  }
  .emoji {
    width: 1.5em;
    text-align: center;
  }
  .name {
    flex: 1;
    font-weight: 600;
  }
  .count {
    font-size: 0.8rem;
    color: var(--muted);
  }
  .chev {
    color: var(--muted);
    transition: transform 0.15s;
  }
  .open .chev {
    transform: rotate(90deg);
  }
  .body {
    display: grid;
    gap: 8px;
    padding: 0 0 14px;
  }
  .ident {
    display: grid;
    grid-template-columns: 48px 1fr 40px 40px;
    gap: 6px;
  }
  .sub {
    display: grid;
    grid-template-columns: 48px 1fr 100px 32px;
    gap: 6px;
    align-items: center;
  }
  .sub.add {
    grid-template-columns: 48px 1fr auto;
  }
  .sub :global(.money) {
    width: 100%;
  }
  input {
    height: 44px;
    min-width: 0;
    border: none;
    border-radius: 10px;
    background: var(--field);
    color: var(--text);
    padding: 0 10px;
  }
  .emoji-in {
    text-align: center;
    padding: 0;
  }
  h3 {
    margin: 8px 0 0;
    font-size: 0.85rem;
  }
  .hint {
    margin: 0;
    font-size: 0.8rem;
    color: var(--muted);
  }
  .hint.warn {
    color: var(--warn);
  }
  .icon {
    height: 40px;
    border-radius: 10px;
    background: var(--field);
    color: var(--text);
    font-size: 1.1rem;
  }
  .sub .icon {
    background: none;
    color: var(--muted);
    font-size: 1.4rem;
  }
  .icon:disabled {
    opacity: 0.3;
  }
  .add-btn {
    height: 44px;
    padding: 0 14px;
    border-radius: 10px;
    background: var(--accent);
    color: var(--on-accent);
    font-weight: 600;
  }
  .add-btn:disabled {
    opacity: 0.4;
  }
  .remove {
    margin-top: 6px;
    height: 44px;
    border-radius: 10px;
    background: none;
    color: var(--danger);
    font-weight: 600;
  }
  .remove.confirm {
    background: var(--danger);
    color: #fff;
  }
  .new {
    display: grid;
    grid-template-columns: 48px 1fr auto;
    gap: 6px;
    margin-top: 12px;
  }
</style>

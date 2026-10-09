<script lang="ts">
  import Keypad from '../components/Keypad.svelte'
  import type { MonthStats } from '../lib/budget'
  import { addDays, dayLabel, monthOf } from '../lib/dates'
  import type { Category } from '../lib/db'
  import { addTransaction, deleteTransaction } from '../lib/db'
  import { applyKey, formatEUR, formatEURRounded, keypadToCents, type KeypadKey } from '../lib/money'
  import { showToast } from '../lib/toast.svelte'

  let { categories, stats, today }: { categories: Category[]; stats: MonthStats | null; today: string } = $props()

  let amountText = $state('')
  let label = $state('')
  // svelte-ignore state_referenced_locally
  let date = $state(today)
  let typing = $state(false)
  let shake = $state(false)
  let saving = false

  // Nouveau jour (appli rouverte le lendemain) : on revient sur « Aujourd'hui »
  $effect(() => {
    date = today
  })

  const cents = $derived(keypadToCents(amountText))
  const statById = $derived(new Map(stats?.categories.map((s) => [s.category.id, s]) ?? []))
  const display = $derived(amountText === '' ? '0' : amountText)

  function onkey(key: KeypadKey) {
    amountText = applyKey(amountText, key)
  }

  function toggleDate() {
    date = date === today ? addDays(today, -1) : today
  }

  function nudge() {
    shake = false
    requestAnimationFrame(() => (shake = true))
  }

  async function pick(c: Category) {
    if (cents <= 0) return nudge()
    if (saving) return
    saving = true
    try {
      const amount = cents
      const tx = await addTransaction({ amount, date, categoryId: c.id, label })
      amountText = ''
      label = ''
      showToast(feedback(c, amount, tx.id), 4500)
    } finally {
      saving = false
    }
  }

  function feedback(c: Category, amount: number, txId: string) {
    const base = {
      message: `${formatEUR(amount)} · ${c.emoji} ${c.name}`,
      action: { label: 'Annuler', run: () => deleteTransaction(txId) },
    }
    const st = statById.get(c.id)
    if (!st || monthOf(date) !== stats?.monthId) return { ...base, detail: dayLabel(date, today) }
    if (st.budget <= 0) return { ...base, detail: 'Pas de budget pour cette catégorie', tone: 'warn' as const }
    const remaining = st.remaining - amount
    if (remaining < 0) return { ...base, detail: `Budget dépassé de ${formatEURRounded(-remaining)}`, tone: 'over' as const }
    if (st.spent + amount >= st.budget * 0.8)
      return { ...base, detail: `Plus que ${formatEURRounded(remaining)} ce mois-ci`, tone: 'warn' as const }
    return { ...base, detail: `Reste ${formatEURRounded(remaining)}`, tone: 'ok' as const }
  }

  // Clavier physique (tests sur ordinateur)
  function onWindowKey(e: KeyboardEvent) {
    if (typing || e.metaKey || e.ctrlKey) return
    if (/^\d$/.test(e.key)) onkey(e.key as KeypadKey)
    else if (e.key === ',' || e.key === '.') onkey(',')
    else if (e.key === 'Backspace') onkey('back')
  }
</script>

<svelte:window onkeydown={onWindowKey} />

<section class="entry" class:typing>
  <header>
    <div class="date">
      <button type="button" class="chip" class:past={date !== today} onclick={toggleDate}>
        {dayLabel(date, today)}
      </button>
      <label class="cal" aria-label="Choisir une date">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="15" rx="3" fill="none" stroke="currentColor" stroke-width="1.8" />
          <path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
        <input type="date" bind:value={date} max={today} />
      </label>
    </div>
    {#if stats && stats.totalBudget > 0}
      <div class="left">
        <span>Reste ce mois</span>
        <b class:neg={stats.remaining < 0}>{formatEURRounded(stats.remaining)}</b>
      </div>
    {/if}
  </header>

  <div class="amount" class:empty={amountText === ''} class:shake onanimationend={() => (shake = false)}>
    <span class="value">{display}</span><span class="cur">€</span>
  </div>

  <input
    class="label"
    type="text"
    placeholder="Libellé (facultatif)"
    autocomplete="off"
    autocapitalize="words"
    enterkeyhint="done"
    bind:value={label}
    onfocus={() => (typing = true)}
    onblur={() => (typing = false)}
    onkeydown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
  />

  <div class="grid">
    {#each categories as c (c.id)}
      {@const st = statById.get(c.id)}
      <button type="button" class="tile" onpointerdown={(e) => typing && e.preventDefault()} onclick={() => pick(c)}>
        <span class="emoji" aria-hidden="true">{c.emoji}</span>
        <span class="name">{c.name}</span>
        {#if st && st.budget > 0}
          <span class="rest {st.status}">{st.remaining >= 0 ? formatEURRounded(st.remaining) : `−${formatEURRounded(-st.remaining)}`}</span>
        {/if}
      </button>
    {/each}
  </div>

  {#if !typing}
    <Keypad {onkey} />
  {/if}
</section>

<style>
  .entry {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 8px 16px 10px;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .date {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .chip {
    height: 36px;
    padding: 0 14px;
    border-radius: 999px;
    background: var(--field);
    color: var(--text);
    font-weight: 600;
  }
  .chip.past {
    background: var(--accent-soft);
    color: var(--accent-text);
  }
  .cal {
    position: relative;
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    color: var(--muted);
  }
  /* Champ date natif invisible posé sur l'icône : un tap ouvre le calendrier iOS */
  .cal input {
    position: absolute;
    inset: 0;
    opacity: 0;
    width: 100%;
    height: 100%;
  }
  .left {
    display: grid;
    text-align: right;
    line-height: 1.15;
  }
  .left span {
    font-size: 0.75rem;
    color: var(--muted);
  }
  .left b {
    font-variant-numeric: tabular-nums;
  }
  .left b.neg {
    color: var(--danger);
  }
  .amount {
    flex: 1;
    min-height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-variant-numeric: tabular-nums;
  }
  .typing .amount {
    flex: 0 0 auto;
  }
  .value {
    font-size: clamp(2.8rem, 9dvh, 4.2rem);
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .cur {
    font-size: 1.8rem;
    color: var(--muted);
  }
  .amount.empty .value {
    color: var(--muted);
    opacity: 0.6;
  }
  .amount.shake {
    animation: shake 0.3s;
  }
  @keyframes shake {
    25% {
      transform: translateX(-8px);
    }
    75% {
      transform: translateX(8px);
    }
  }
  .label {
    height: 44px;
    border: none;
    border-radius: 12px;
    background: var(--field);
    color: var(--text);
    padding: 0 14px;
    text-align: center;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }
  .tile {
    height: clamp(58px, 8.4dvh, 72px);
    border-radius: 14px;
    background: var(--surface);
    color: var(--text);
    display: grid;
    grid-template-rows: auto auto auto;
    place-content: center;
    justify-items: center;
    gap: 0;
    line-height: 1.15;
    box-shadow: 0 0 0 1px var(--line) inset;
  }
  .tile:active {
    transform: scale(0.96);
    background: var(--accent-soft);
  }
  .emoji {
    font-size: 1.25rem;
  }
  .name {
    font-size: 0.78rem;
    font-weight: 600;
  }
  .rest {
    font-size: 0.7rem;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .rest.pace,
  .rest.warn {
    color: var(--warn);
  }
  .rest.over {
    color: var(--danger);
  }
</style>

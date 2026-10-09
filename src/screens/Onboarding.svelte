<script lang="ts">
  import BudgetSplit from '../components/BudgetSplit.svelte'
  import FixedChargesEditor from '../components/FixedChargesEditor.svelte'
  import MoneyField from '../components/MoneyField.svelte'
  import { proposeBudgets } from '../lib/categories'
  import type { Category, FixedChargeInput } from '../lib/db'
  import { completeOnboarding, newId } from '../lib/db'
  import { formatEUR } from '../lib/money'

  let { categories }: { categories: Category[] } = $props()

  let step = $state(0)
  let income = $state(0)
  let fixed = $state<FixedChargeInput[]>([{ id: newId(), label: 'Loyer', amount: 0 }])
  let savingsGoal = $state(0)
  let budgets = $state<Record<string, number>>({})
  let budgetsTouched = $state(false)
  let saving = $state(false)

  const fixedTotal = $derived(fixed.reduce((s, f) => s + f.amount, 0))
  const available = $derived(income - fixedTotal - savingsGoal)
  const savingsPct = $derived(income > 0 ? Math.round((savingsGoal / income) * 100) : 0)

  const STEPS = ['Revenu', 'Charges fixes', 'Épargne', 'Répartition']

  const canContinue = $derived([income > 0, true, savingsGoal >= 0 && available > 0, true][step])

  function next() {
    if (step === 2 && !budgetsTouched) budgets = proposeBudgets(available, categories)
    if (step < 3) step += 1
    else finish()
  }

  async function finish() {
    saving = true
    await completeOnboarding({ income, savingsGoal, fixed, budgets })
  }
</script>

<section class="onboarding">
  <div class="progress" aria-label={`Étape ${step + 1} sur 4`}>
    {#each STEPS as s, i (s)}
      <span class:done={i <= step}></span>
    {/each}
  </div>

  <div class="body">
    {#if step === 0}
      <h1>Bienvenue 👋</h1>
      <p class="lead">
        Quatre questions pour construire ton budget. Tout reste sur ton iPhone : rien n'est envoyé nulle part.
      </p>
      <h2>Quel est ton revenu mensuel net ?</h2>
      <div class="big-field"><MoneyField bind:value={income} ariaLabel="Revenu mensuel net" /></div>
      <p class="hint">Ce que tu touches chaque mois sur ton compte, après impôts.</p>
    {:else if step === 1}
      <h1>Charges fixes</h1>
      <p class="lead">
        Ce qui part tous les mois quoi qu'il arrive : loyer, factures, abonnements, assurances. Elles sont déduites
        d'office et n'entrent pas dans les catégories.
      </p>
      <FixedChargesEditor bind:items={fixed} />
    {:else if step === 2}
      <h1>Objectif d'épargne</h1>
      <p class="lead">Combien veux-tu mettre de côté chaque mois ?</p>
      <div class="big-field"><MoneyField bind:value={savingsGoal} ariaLabel="Épargne mensuelle" /></div>
      {#if income > 0}
        <p class="hint">
          {savingsPct} % de ton revenu. Il resterait <b class:neg={available <= 0}>{formatEUR(Math.max(0, available))}</b>
          pour tes dépenses du quotidien.
        </p>
      {/if}
      {#if available <= 0}
        <p class="hint neg">Avec cet objectif, il ne reste rien pour les dépenses : baisse-le un peu.</p>
      {/if}
      <p class="hint">Ce que tu ne dépenses pas en fin de mois s'ajoutera automatiquement à cette épargne.</p>
    {:else}
      <h1>Répartition</h1>
      <p class="lead">Voici une proposition. Ajuste les montants comme tu veux, tu pourras les modifier plus tard.</p>
      <BudgetSplit {categories} bind:budgets {available} onchange={() => (budgetsTouched = true)} />
    {/if}
  </div>

  <footer>
    {#if step > 0}
      <button type="button" class="back" onclick={() => (step -= 1)}>Retour</button>
    {/if}
    <button type="button" class="primary" disabled={!canContinue || saving} onclick={next}>
      {step < 3 ? 'Continuer' : 'Commencer'}
    </button>
  </footer>
</section>

<style>
  .onboarding {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    max-width: 560px;
    margin: 0 auto;
    padding: calc(env(safe-area-inset-top) + 16px) 16px calc(env(safe-area-inset-bottom) + 16px);
  }
  .progress {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }
  .progress span {
    height: 4px;
    border-radius: 2px;
    background: var(--track);
  }
  .progress span.done {
    background: var(--accent);
  }
  .body {
    flex: 1;
    padding: 24px 0;
  }
  h1 {
    margin: 0 0 8px;
    font-size: 1.8rem;
    letter-spacing: -0.02em;
  }
  h2 {
    margin: 28px 0 12px;
    font-size: 1.1rem;
  }
  .lead {
    margin: 0 0 20px;
    color: var(--muted);
  }
  .big-field :global(.money) {
    width: 100%;
  }
  .big-field :global(input) {
    height: 64px;
    font-size: 2rem;
    font-weight: 700;
  }
  .hint {
    color: var(--muted);
    font-size: 0.95rem;
  }
  .hint b {
    color: var(--text);
  }
  .neg,
  .hint b.neg {
    color: var(--danger);
  }
  footer {
    display: flex;
    gap: 10px;
    position: sticky;
    bottom: 0;
    padding-top: 12px;
    background: var(--bg);
  }
  .primary {
    flex: 1;
    height: 54px;
    border-radius: 14px;
    background: var(--accent);
    color: var(--on-accent);
    font-size: 1.05rem;
    font-weight: 700;
  }
  .primary:disabled {
    opacity: 0.4;
  }
  .back {
    height: 54px;
    padding: 0 18px;
    border-radius: 14px;
    background: var(--field);
    color: var(--text);
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte'
  import BudgetSplit from '../components/BudgetSplit.svelte'
  import CategoryEditor from '../components/CategoryEditor.svelte'
  import FixedChargesEditor from '../components/FixedChargesEditor.svelte'
  import MoneyField from '../components/MoneyField.svelte'
  import { readBackup, restoreBackup, type BackupSummary } from '../lib/backup'
  import { daysSince, longDate } from '../lib/dates'
  import type { Category, FixedChargeInput, Settings, Subcategory, Theme } from '../lib/db'
  import { db, saveCategoryBudgets, saveFixedCharges, syncCurrentMonth, updateSettings } from '../lib/db'
  import { formatBytes, isPersisted, isStandalone, requestPersist, storageEstimate } from '../lib/platform'
  import { showToast } from '../lib/toast.svelte'

  let {
    settings,
    categories,
    subcategories,
    onbackup,
  }: {
    settings: Settings
    categories: Category[]
    subcategories: Subcategory[]
    onbackup: () => void
  } = $props()

  // Copies locales éditables, enregistrées champ par champ
  // svelte-ignore state_referenced_locally
  let income = $state(settings.income)
  // svelte-ignore state_referenced_locally
  let savingsGoal = $state(settings.savingsGoal)
  let fixed = $state<FixedChargeInput[]>([])
  // svelte-ignore state_referenced_locally
  let budgets = $state<Record<string, number>>(Object.fromEntries(categories.map((c) => [c.id, c.budget])))

  let persisted = $state<boolean | null>(null)
  let usage = $state<string>('—')
  // $state.raw : la sauvegarde doit rester un objet simple, IndexedDB ne sait pas copier les proxys Svelte
  let pending = $state.raw<{ backup: Parameters<typeof restoreBackup>[0]; summary: BackupSummary } | null>(null)
  let fileInput: HTMLInputElement

  const fixedTotal = $derived(fixed.reduce((s, f) => s + f.amount, 0))
  const available = $derived(income - fixedTotal - savingsGoal)

  onMount(async () => {
    fixed = (await db.recurring.where('kind').equals('fixed').toArray()).map(({ id, label, amount }) => ({ id, label, amount }))
    persisted = await isPersisted()
    const est = await storageEstimate()
    if (est) usage = `${formatBytes(est.usage)} sur ${formatBytes(est.quota)}`
  })

  async function saveMoney() {
    await updateSettings({ income, savingsGoal })
    await syncCurrentMonth()
  }

  async function saveFixed() {
    await saveFixedCharges(fixed)
    await syncCurrentMonth()
  }

  async function saveBudgets() {
    await saveCategoryBudgets(budgets)
    await syncCurrentMonth()
  }

  async function setTheme(theme: Theme) {
    await updateSettings({ theme })
  }

  async function askPersist() {
    persisted = await requestPersist()
  }

  async function onFile(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0]
    ;(e.currentTarget as HTMLInputElement).value = ''
    if (!file) return
    try {
      pending = await readBackup(file)
    } catch (err) {
      showToast({ message: (err as Error).message, tone: 'over' })
    }
  }

  async function confirmRestore() {
    if (!pending) return
    try {
      await restoreBackup(pending.backup)
    } catch (err) {
      showToast({ message: `Échec de la restauration, données inchangées : ${(err as Error).message}`, tone: 'over' }, 8000)
      return
    }
    pending = null
    showToast({ message: 'Sauvegarde restaurée', tone: 'ok' })
    // Les copies locales de cet écran sont périmées : on recharge l'appli
    setTimeout(() => location.reload(), 600)
  }

  const backupText = $derived(
    settings.lastBackupAt
      ? `Dernière sauvegarde : ${longDate(settings.lastBackupAt)} (${daysSince(settings.lastBackupAt) === 0 ? "aujourd'hui" : `il y a ${daysSince(settings.lastBackupAt)} j`})`
      : 'Aucune sauvegarde pour le moment.',
  )

  const THEMES: { id: Theme; label: string }[] = [
    { id: 'auto', label: 'Auto' },
    { id: 'light', label: 'Clair' },
    { id: 'dark', label: 'Sombre' },
  ]
</script>

<section class="settings">
  <h1>Réglages</h1>

  <div class="card">
    <h2>Budget mensuel</h2>
    <div class="line">
      <span>Revenu net</span>
      <MoneyField bind:value={income} ariaLabel="Revenu mensuel net" onchange={saveMoney} />
    </div>
    <div class="line">
      <span>Objectif d'épargne</span>
      <MoneyField bind:value={savingsGoal} ariaLabel="Objectif d'épargne" onchange={saveMoney} />
    </div>
    <p class="note">Les changements s'appliquent au mois en cours ; les mois passés ne bougent pas.</p>
  </div>

  <div class="card">
    <h2>Charges fixes</h2>
    <FixedChargesEditor bind:items={fixed} onchange={saveFixed} />
  </div>

  <div class="card">
    <h2>Répartition par catégorie</h2>
    <BudgetSplit {categories} bind:budgets {available} onchange={saveBudgets} />
  </div>

  <div class="card">
    <h2>Catégories et sous-catégories</h2>
    <CategoryEditor {categories} {subcategories} />
  </div>

  <div class="card">
    <h2>Sauvegarde</h2>
    <p class="note first">{backupText}</p>
    <p class="note">
      Le fichier s'ouvre dans le menu de partage : choisis <b>Enregistrer dans Fichiers</b>. Garde-le hors de
      l'appli : si tu supprimes l'icône, les données de l'appli sont effacées.
    </p>
    <button type="button" class="primary" onclick={onbackup}>Sauvegarder maintenant</button>
    <button type="button" class="secondary" onclick={() => fileInput.click()}>Restaurer une sauvegarde…</button>
    <input bind:this={fileInput} type="file" accept="application/json,.json" hidden onchange={onFile} />

    {#if pending}
      <div class="confirm">
        <p>
          Remplacer <b>toutes</b> les données actuelles par la sauvegarde du
          <b>{longDate(pending.summary.exportedAt)}</b> ({pending.summary.transactions} dépenses) ?
        </p>
        <div class="row">
          <button type="button" class="secondary" onclick={() => (pending = null)}>Annuler</button>
          <button type="button" class="danger" onclick={confirmRestore}>Remplacer</button>
        </div>
      </div>
    {/if}
  </div>

  <div class="card">
    <h2>Apparence</h2>
    <div class="segmented" role="radiogroup" aria-label="Thème">
      {#each THEMES as t (t.id)}
        <button
          type="button"
          role="radio"
          aria-checked={settings.theme === t.id}
          class:on={settings.theme === t.id}
          onclick={() => setTheme(t.id)}
        >
          {t.label}
        </button>
      {/each}
    </div>
  </div>

  <div class="card">
    <h2>Stockage</h2>
    <div class="line"><span>Lancée depuis l'icône</span><b>{isStandalone() ? 'Oui' : 'Non'}</b></div>
    <div class="line">
      <span>Stockage persistant</span>
      {#if persisted === null}
        <b>Non pris en charge</b>
      {:else if persisted}
        <b class="ok">Accordé</b>
      {:else}
        <button type="button" class="link" onclick={askPersist}>Demander</button>
      {/if}
    </div>
    <div class="line"><span>Espace utilisé</span><b>{usage}</b></div>
  </div>

  <p class="version">Budget · V1 · données 100 % locales</p>
</section>

<style>
  .settings {
    display: grid;
    gap: 12px;
    padding: 8px 16px 24px;
  }
  h1 {
    margin: 0;
    font-size: 1.6rem;
    letter-spacing: -0.02em;
  }
  .card {
    background: var(--surface);
    border-radius: 16px;
    padding: 16px;
  }
  h2 {
    margin: 0 0 12px;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
  }
  .line {
    display: grid;
    grid-template-columns: 1fr 140px;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
  }
  .line b {
    text-align: right;
  }
  .note {
    margin: 10px 0 0;
    font-size: 0.85rem;
    color: var(--muted);
  }
  .note.first {
    margin-top: 0;
  }
  .note b {
    color: var(--text);
  }
  .primary,
  .secondary,
  .danger {
    width: 100%;
    height: 48px;
    border-radius: 12px;
    font-weight: 600;
    margin-top: 12px;
  }
  .primary {
    background: var(--accent);
    color: var(--on-accent);
  }
  .secondary {
    background: var(--field);
    color: var(--text);
  }
  .danger {
    background: var(--danger);
    color: #fff;
  }
  .confirm {
    margin-top: 12px;
    padding: 12px;
    border-radius: 12px;
    background: var(--danger-soft);
  }
  .confirm p {
    margin: 0;
  }
  .confirm .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .segmented {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    background: var(--field);
    border-radius: 12px;
    padding: 3px;
  }
  .segmented button {
    height: 38px;
    border-radius: 9px;
    background: transparent;
    color: var(--text);
  }
  .segmented button.on {
    background: var(--surface);
    font-weight: 600;
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.15);
  }
  .ok {
    color: var(--ok);
  }
  .link {
    justify-self: end;
    background: none;
    color: var(--accent-text);
    text-decoration: underline;
  }
  .version {
    text-align: center;
    font-size: 0.8rem;
    color: var(--muted);
  }
</style>

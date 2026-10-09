<script lang="ts">
  import { liveQuery } from 'dexie'
  import { onMount } from 'svelte'
  import { exportBackup } from './lib/backup'
  import { computeStats } from './lib/budget'
  import { daysSince, localISO, monthOf } from './lib/dates'
  import type { Category, Month, Settings, Transaction } from './lib/db'
  import { db, ensureMonth, ensureSeed, getSettings } from './lib/db'
  import { isIOS, isStandalone, requestPersist } from './lib/platform'
  import { hideToast, showToast, toastState } from './lib/toast.svelte'
  import { applyUpdate, updateState } from './lib/update.svelte'
  import Dashboard from './screens/Dashboard.svelte'
  import Entry from './screens/Entry.svelte'
  import Expenses from './screens/Expenses.svelte'
  import Onboarding from './screens/Onboarding.svelte'
  import SettingsScreen from './screens/Settings.svelte'

  type Tab = 'entry' | 'dashboard' | 'expenses' | 'settings'

  interface AppData {
    settings: Settings
    categories: Category[]
    month: Month | undefined
    transactions: Transaction[]
    totalCount: number
  }

  let today = $state(localISO())
  let tab = $state<Tab>('entry')
  let data = $state<AppData | null>(null)
  let error = $state<string | null>(null)
  let ready = $state(false)

  const monthId = $derived(monthOf(today))
  const showInstallHint = isIOS() && !isStandalone()

  onMount(() => {
    ;(async () => {
      try {
        await ensureSeed()
        await ensureMonth(monthOf(localISO()))
        ready = true
      } catch (e) {
        error = String(e)
      }
    })()
    requestPersist()

    // Au retour sur l'appli : nouveau jour / nouveau mois éventuel
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const now = localISO()
      if (now !== today) {
        today = now
        ensureMonth(monthOf(now))
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  })

  // Une seule requête « vivante » : se met à jour à chaque écriture dans la base
  $effect(() => {
    if (!ready) return
    const m = monthId
    const sub = liveQuery(async () => ({
      settings: await getSettings(),
      categories: await db.categories.orderBy('order').filter((c) => !c.archived).toArray(),
      month: await db.months.get(m),
      transactions: await db.transactions.where('month').equals(m).toArray(),
      totalCount: await db.transactions.count(),
    })).subscribe({
      next: (v) => (data = v),
      error: (e) => (error = String(e)),
    })
    return () => sub.unsubscribe()
  })

  const stats = $derived(
    data?.month ? computeStats(data.month, data.categories, data.transactions, today) : null,
  )

  // Rappel de sauvegarde : jamais faite (et des données existent) ou plus de 7 jours
  const backupDue = $derived.by(() => {
    if (!data || data.totalCount === 0) return null
    const last = data.settings.lastBackupAt
    if (!last) return 'Tu n’as encore jamais sauvegardé tes données.'
    const d = daysSince(last)
    return d >= 7 ? `Dernière sauvegarde il y a ${d} jours.` : null
  })

  $effect(() => {
    const theme = data?.settings.theme ?? 'auto'
    if (theme === 'auto') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = theme
  })

  async function backup() {
    try {
      if (await exportBackup()) showToast({ message: 'Sauvegarde créée', tone: 'ok' })
    } catch (e) {
      showToast({ message: `Échec de la sauvegarde : ${(e as Error).message}`, tone: 'over' })
    }
  }

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'entry', label: 'Saisie', icon: 'M12 5v14M5 12h14' },
    { id: 'dashboard', label: 'Budget', icon: 'M4 7h12M4 12h8M4 17h14' },
    { id: 'expenses', label: 'Dépenses', icon: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01' },
    {
      id: 'settings',
      label: 'Réglages',
      icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13a7.5 7.5 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-1.7-1L15 3h-4l-.3 2.5a7.5 7.5 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.5 7.5 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 1.7 1L11 21h4l.3-2.5a7.5 7.5 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6z',
    },
  ]
</script>

{#if error}
  <div class="fatal">
    <h1>Oups</h1>
    <p>Impossible d'ouvrir la base de données.</p>
    <code>{error}</code>
  </div>
{:else if !data}
  <div class="loading" aria-busy="true"></div>
{:else if !data.settings.onboarded}
  <Onboarding categories={data.categories} />
{:else}
  <div class="app">
    {#if updateState.available}
      <div class="update">
        <span>Nouvelle version disponible</span>
        <button type="button" onclick={applyUpdate}>Mettre à jour</button>
      </div>
    {/if}
    {#if showInstallHint}
      <div class="install">
        Ouverte dans Safari : les données ici sont séparées de l'appli installée. Pour installer : <b>Partager</b> ›
        <b>Sur l'écran d'accueil</b>.
      </div>
    {/if}

    <main class:fixed={tab === 'entry'}>
      {#if tab === 'entry'}
        <Entry categories={data.categories} {stats} {today} />
      {:else if tab === 'dashboard' && stats}
        <Dashboard {stats} {backupDue} onbackup={backup} />
      {:else if tab === 'expenses'}
        <Expenses transactions={data.transactions} categories={data.categories} {today} {monthId} />
      {:else if tab === 'settings'}
        <SettingsScreen settings={data.settings} categories={data.categories} onbackup={backup} />
      {/if}
    </main>

    <nav class="tabs" aria-label="Navigation">
      {#each TABS as t (t.id)}
        <button type="button" class:on={tab === t.id} aria-current={tab === t.id ? 'page' : undefined} onclick={() => (tab = t.id)}>
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path d={t.icon} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>{t.label}</span>
          {#if t.id === 'dashboard' && backupDue}<i class="dot" aria-label="Sauvegarde à faire"></i>{/if}
        </button>
      {/each}
    </nav>
  </div>
{/if}

{#if toastState.current}
  {@const t = toastState.current}
  {#key t.id}
    <div class="toast {t.tone ?? ''}" role="status">
      <div class="msg">
        <b>{t.message}</b>
        {#if t.detail}<span>{t.detail}</span>{/if}
      </div>
      {#if t.action}
        <button
          type="button"
          onclick={() => {
            t.action?.run()
            hideToast()
          }}>{t.action.label}</button
        >
      {/if}
    </div>
  {/key}
{/if}

<style>
  .app {
    height: 100dvh;
    display: flex;
    flex-direction: column;
    max-width: 560px;
    margin: 0 auto;
    padding-top: env(safe-area-inset-top);
  }
  main {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
  main.fixed {
    overflow: hidden;
  }
  .install {
    margin: 8px 16px 0;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--warn-soft);
    font-size: 0.85rem;
  }
  .update {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: 8px 16px 0;
    padding: 8px 8px 8px 14px;
    border-radius: 12px;
    background: var(--accent-soft);
    font-size: 0.9rem;
  }
  .update button {
    padding: 8px 12px;
    border-radius: 9px;
    background: var(--accent);
    color: var(--on-accent);
    font-weight: 600;
  }
  .tabs {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    padding: 4px 8px calc(env(safe-area-inset-bottom) + 4px);
    border-top: 1px solid var(--line);
    background: var(--bg);
  }
  .tabs button {
    position: relative;
    display: grid;
    justify-items: center;
    gap: 2px;
    padding: 6px 0;
    background: none;
    color: var(--muted);
    font-size: 0.7rem;
  }
  .tabs button.on {
    color: var(--accent-text);
    font-weight: 600;
  }
  .dot {
    position: absolute;
    top: 6px;
    left: calc(50% + 10px);
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--warn);
  }
  .toast {
    position: fixed;
    left: 12px;
    right: 12px;
    bottom: calc(env(safe-area-inset-bottom) + 72px);
    max-width: 536px;
    margin: 0 auto;
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 14px;
    background: var(--toast);
    color: var(--on-toast);
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.25);
    border-left: 4px solid transparent;
    animation: pop 0.18s ease-out;
  }
  .toast.ok {
    border-left-color: var(--ok);
  }
  .toast.warn,
  .toast.pace {
    border-left-color: var(--warn);
  }
  .toast.over {
    border-left-color: var(--danger);
  }
  @keyframes pop {
    from {
      transform: translateY(12px);
      opacity: 0;
    }
  }
  .msg {
    flex: 1;
    display: grid;
    min-width: 0;
  }
  .msg span {
    font-size: 0.85rem;
    opacity: 0.8;
  }
  .toast button {
    background: none;
    color: var(--toast-action);
    font-weight: 700;
    padding: 6px 4px;
  }
  .fatal {
    padding: 32px 16px;
  }
  .fatal code {
    display: block;
    margin-top: 12px;
    font-size: 0.8rem;
    word-break: break-word;
    color: var(--muted);
  }
  .loading {
    height: 100dvh;
  }
</style>

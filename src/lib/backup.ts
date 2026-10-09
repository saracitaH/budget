import { db, ensureSeed, updateSettings } from './db'
import { localISO } from './dates'

const APP_ID = 'budget-pwa'
const FORMAT_VERSION = 2 // 2 : ajout des sous-catégories

interface BackupFile {
  app: typeof APP_ID
  format: number
  exportedAt: string
  data: {
    meta: unknown[]
    categories: unknown[]
    /** Absent des sauvegardes au format 1 */
    subcategories?: unknown[]
    transactions: unknown[]
    recurring: unknown[]
    months: unknown[]
  }
}

async function buildBackup(): Promise<BackupFile> {
  return db.transaction('r', [db.meta, db.categories, db.subcategories, db.transactions, db.recurring, db.months], async () => ({
    app: APP_ID,
    format: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      meta: await db.meta.toArray(),
      categories: await db.categories.toArray(),
      subcategories: await db.subcategories.toArray(),
      transactions: await db.transactions.toArray(),
      recurring: await db.recurring.toArray(),
      months: await db.months.toArray(),
    },
  }))
}

/**
 * Ouvre la feuille de partage iOS avec le fichier JSON (« Enregistrer dans Fichiers »).
 * Repli : téléchargement classique. Renvoie false si l'utilisateur annule.
 */
export async function exportBackup(): Promise<boolean> {
  const backup = await buildBackup()
  const name = `budget-sauvegarde-${localISO()}.json`
  const file = new File([JSON.stringify(backup)], name, { type: 'application/json' })

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return false
      throw e
    }
  } else {
    const url = URL.createObjectURL(file)
    const a = Object.assign(document.createElement('a'), { href: url, download: name })
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  await updateSettings({ lastBackupAt: new Date().toISOString() })
  return true
}

export interface BackupSummary {
  exportedAt: string
  transactions: number
}

export async function readBackup(file: File): Promise<{ backup: BackupFile; summary: BackupSummary }> {
  let backup: BackupFile
  try {
    backup = JSON.parse(await file.text())
  } catch {
    throw new Error("Ce fichier n'est pas une sauvegarde valide.")
  }
  if (backup?.app !== APP_ID || !backup.data || !Array.isArray(backup.data.transactions)) {
    throw new Error("Ce fichier n'est pas une sauvegarde de l'appli Budget.")
  }
  if (backup.format > FORMAT_VERSION) {
    throw new Error('Cette sauvegarde vient d’une version plus récente de l’appli.')
  }
  return { backup, summary: { exportedAt: backup.exportedAt, transactions: backup.data.transactions.length } }
}

/** Remplace toutes les données par celles de la sauvegarde. */
export async function restoreBackup(backup: BackupFile): Promise<void> {
  const tables = [db.meta, db.categories, db.subcategories, db.transactions, db.recurring, db.months]
  await db.transaction('rw', tables, async () => {
    await Promise.all(tables.map((t) => t.clear()))
    const d = backup.data
    await db.meta.bulkAdd(d.meta as never[])
    await db.categories.bulkAdd(d.categories as never[])
    await db.subcategories.bulkAdd((d.subcategories ?? []) as never[])
    await db.transactions.bulkAdd(d.transactions as never[])
    await db.recurring.bulkAdd(d.recurring as never[])
    await db.months.bulkAdd(d.months as never[])
  })
  await ensureSeed()
}

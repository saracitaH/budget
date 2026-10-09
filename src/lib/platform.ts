/** Vrai quand l'appli est lancée depuis l'icône de l'écran d'accueil (et non dans Safari). */
export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true || matchMedia('(display-mode: standalone)').matches
}

export function isIOS(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export async function isPersisted(): Promise<boolean | null> {
  if (!navigator.storage?.persisted) return null
  return navigator.storage.persisted()
}

export async function requestPersist(): Promise<boolean | null> {
  if (!navigator.storage?.persist) return null
  return navigator.storage.persist()
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null
  const { usage = 0, quota = 0 } = await navigator.storage.estimate()
  return { usage, quota }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} Ko`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} Mo`
  return `${(n / 1024 ** 3).toFixed(1)} Go`
}

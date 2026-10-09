import { registerSW } from 'virtual:pwa-register'

// Mise à jour à la demande : jamais de rechargement surprise en pleine saisie
export const updateState = $state({ available: false })

let updateSW: ((reload?: boolean) => Promise<void>) | undefined

export function initUpdates() {
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateState.available = true
    },
  })
}

export function applyUpdate() {
  updateSW?.(true)
}

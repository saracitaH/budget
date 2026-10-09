import type { Status } from './budget'

export interface Toast {
  id: number
  message: string
  detail?: string
  tone?: Status
  action?: { label: string; run: () => void }
}

export const toastState = $state<{ current: Toast | null }>({ current: null })

let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0

export function showToast(t: Omit<Toast, 'id'>, ms = 4000) {
  clearTimeout(timer)
  toastState.current = { ...t, id: ++seq }
  timer = setTimeout(() => (toastState.current = null), ms)
}

export function hideToast() {
  clearTimeout(timer)
  toastState.current = null
}

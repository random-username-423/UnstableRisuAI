import { toastState } from './stores.svelte'

export { toastState }

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
    id: string
    msg: string
    duration: number
    timestamp: number
    type: ToastType
}

const MAX_TOASTS = 5

export function addToast(msg: string, duration: number = 3000, type: ToastType = 'info') {
    const toast: ToastItem = {
        id: crypto.randomUUID(),
        msg: msg,
        duration: duration,
        timestamp: Date.now(),
        type: type
    }

    toastState.queue.unshift(toast)

    // Limit to maximum toast items
    if (toastState.queue.length > MAX_TOASTS) {
        toastState.queue.pop()
    }
}

export function removeToast(id: string) {
    const index = toastState.queue.findIndex(t => t.id === id)
    if (index !== -1) {
        toastState.queue.splice(index, 1)
    }
}

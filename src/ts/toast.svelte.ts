import { toastState } from './stores.svelte'

export { toastState }

export interface ToastItem {
    id: string
    msg: string
    duration: number
    timestamp: number
}

export function addToast(msg: string, duration: number = 3000) {
    const toast: ToastItem = {
        id: crypto.randomUUID(),
        msg: msg,
        duration: duration,
        timestamp: Date.now()
    }

    toastState.queue.unshift(toast)

    // 최대 5개로 제한
    if (toastState.queue.length > 5) {
        toastState.queue.pop()
    }
}

export function removeToast(id: string) {
    const index = toastState.queue.findIndex(t => t.id === id)
    if (index !== -1) {
        toastState.queue.splice(index, 1)
    }
}

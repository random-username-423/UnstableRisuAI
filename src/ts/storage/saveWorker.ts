import localforage from "localforage"

interface SaveMessage {
    type: 'save'
    key: string
    data: Uint8Array
}

interface SaveResponse {
    type: 'success' | 'error'
    key: string
    error?: string
}

let storage: LocalForage | null = null

function getStorage(): LocalForage {
    if (!storage) {
        storage = localforage.createInstance({
            name: "risuai"
        })
    }
    return storage
}

// Worker 준비 완료 신호 전송
self.postMessage({ type: 'ready' })

self.onmessage = async (e: MessageEvent<SaveMessage>) => {
    const { type, key, data } = e.data

    if (type === 'save') {
        try {
            await getStorage().setItem(key, data)
            const response: SaveResponse = { type: 'success', key }
            self.postMessage(response)
        } catch (error) {
            const response: SaveResponse = {
                type: 'error',
                key,
                error: error instanceof Error ? error.message : String(error)
            }
            self.postMessage(response)
        }
    }
}

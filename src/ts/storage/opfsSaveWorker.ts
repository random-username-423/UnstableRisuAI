// OPFS (Origin Private File System)를 사용한 파일 저장 Worker
// Tauri 환경에서 IPC 블로킹 없이 파일 저장

// TypeScript 타입 정의 (File System Access API - Worker용)
interface FileSystemSyncAccessHandle {
    read(buffer: ArrayBuffer | ArrayBufferView, options?: { at?: number }): number
    write(buffer: ArrayBuffer | ArrayBufferView, options?: { at?: number }): number
    truncate(size: number): void
    getSize(): number
    flush(): void
    close(): void
}

interface FileSystemFileHandleWithSync extends FileSystemFileHandle {
    createSyncAccessHandle(): Promise<FileSystemSyncAccessHandle>
}

interface SaveMessage {
    type: 'save'
    key: string
    data: Uint8Array
}

interface LoadMessage {
    type: 'load'
    key: string
}

interface SaveResponse {
    type: 'success' | 'error'
    key: string
    error?: string
}

interface LoadResponse {
    type: 'load_success' | 'load_error'
    key: string
    data?: Uint8Array
    error?: string
}

let root: FileSystemDirectoryHandle | null = null

async function getRoot(): Promise<FileSystemDirectoryHandle> {
    if (!root) {
        root = await navigator.storage.getDirectory()
    }
    return root
}

async function ensureDirectory(dirPath: string): Promise<FileSystemDirectoryHandle> {
    const root = await getRoot()
    const parts = dirPath.split('/').filter(p => p)
    let current = root
    for (const part of parts) {
        current = await current.getDirectoryHandle(part, { create: true })
    }
    return current
}

async function getDirectory(dirPath: string): Promise<FileSystemDirectoryHandle | null> {
    try {
        const root = await getRoot()
        const parts = dirPath.split('/').filter(p => p)
        let current = root
        for (const part of parts) {
            current = await current.getDirectoryHandle(part)
        }
        return current
    } catch {
        return null
    }
}

self.onmessage = async (e: MessageEvent<SaveMessage | LoadMessage>) => {
    const { type, key } = e.data

    if (type === 'save') {
        const { data } = e.data as SaveMessage
        try {
            const parts = key.split('/')
            const fileName = parts.pop()!
            const dirPath = parts.join('/')

            const dir = dirPath ? await ensureDirectory(dirPath) : await getRoot()
            const fileHandle = await dir.getFileHandle(fileName, { create: true }) as FileSystemFileHandleWithSync

            // SyncAccessHandle 사용 (Worker에서만 가능, 매우 빠름)
            const accessHandle = await fileHandle.createSyncAccessHandle()
            accessHandle.truncate(0)
            accessHandle.write(data)
            accessHandle.flush()
            accessHandle.close()

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
    } else if (type === 'load') {
        try {
            const parts = key.split('/')
            const fileName = parts.pop()!
            const dirPath = parts.join('/')

            const dir = dirPath ? await getDirectory(dirPath) : await getRoot()
            if (!dir) {
                const response: LoadResponse = {
                    type: 'load_error',
                    key,
                    error: 'Directory not found'
                }
                self.postMessage(response)
                return
            }

            const fileHandle = await dir.getFileHandle(fileName) as FileSystemFileHandleWithSync
            const accessHandle = await fileHandle.createSyncAccessHandle()
            const size = accessHandle.getSize()
            const data = new Uint8Array(size)
            accessHandle.read(data)
            accessHandle.close()

            const response: LoadResponse = { type: 'load_success', key, data }
            self.postMessage(response, { transfer: [data.buffer] })
        } catch (error) {
            const response: LoadResponse = {
                type: 'load_error',
                key,
                error: error instanceof Error ? error.message : String(error)
            }
            self.postMessage(response)
        }
    }
}

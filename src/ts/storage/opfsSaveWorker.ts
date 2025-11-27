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

interface ListMessage {
    type: 'list'
    dirPath: string
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

interface ListResponse {
    type: 'list_success' | 'list_error'
    dirPath: string
    files?: string[]
    error?: string
}

let root: FileSystemDirectoryHandle | null = null

async function getRoot(): Promise<FileSystemDirectoryHandle> {
    if (!root) {
        root = await navigator.storage.getDirectory()
    }
    return root
}

// Worker 준비 완료 신호 전송
self.postMessage({ type: 'ready' })

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

self.onmessage = async (e: MessageEvent<SaveMessage | LoadMessage | ListMessage>) => {
    const { type } = e.data

    if (type === 'save') {
        const { key, data } = e.data as SaveMessage
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
        const { key } = e.data as LoadMessage
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
    } else if (type === 'list') {
        const { dirPath } = e.data as ListMessage
        try {
            const dir = dirPath ? await getDirectory(dirPath) : await getRoot()
            if (!dir) {
                const response: ListResponse = {
                    type: 'list_success',
                    dirPath,
                    files: []
                }
                self.postMessage(response)
                return
            }

            const files: string[] = []
            for await (const [name, handle] of (dir as any).entries()) {
                if (handle.kind === 'file') {
                    files.push(name)
                }
            }

            const response: ListResponse = { type: 'list_success', dirPath, files }
            self.postMessage(response)
        } catch (error) {
            const response: ListResponse = {
                type: 'list_error',
                dirPath,
                error: error instanceof Error ? error.message : String(error)
            }
            self.postMessage(response)
        }
    }
}

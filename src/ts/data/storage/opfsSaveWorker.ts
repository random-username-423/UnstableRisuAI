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

interface ListWithSizesMessage {
    type: 'listWithSizes'
    dirPath: string
}

interface DeleteMessage {
    type: 'delete'
    key: string
}

interface ListRecursiveMessage {
    type: 'listRecursive'
    dirPath: string
}

interface ListWithSizesRecursiveMessage {
    type: 'listWithSizesRecursive'
    dirPath: string
}

interface DeleteDirectoryMessage {
    type: 'deleteDirectory'
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

interface ListWithSizesResponse {
    type: 'listWithSizes_success' | 'listWithSizes_error'
    dirPath: string
    files?: { name: string; size: number }[]
    error?: string
}

interface DeleteResponse {
    type: 'delete_success' | 'delete_error'
    key: string
    error?: string
}

interface ListRecursiveResponse {
    type: 'listRecursive_success' | 'listRecursive_error'
    dirPath: string
    files?: string[]  // 상대 경로 (예: "chaId/chatId.bin")
    error?: string
}

interface ListWithSizesRecursiveResponse {
    type: 'listWithSizesRecursive_success' | 'listWithSizesRecursive_error'
    dirPath: string
    files?: { path: string; size: number }[]  // 상대 경로
    error?: string
}

interface DeleteDirectoryResponse {
    type: 'deleteDirectory_success' | 'deleteDirectory_error'
    dirPath: string
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

// 재귀적으로 모든 파일 경로를 수집
async function listFilesRecursive(dir: FileSystemDirectoryHandle, prefix: string = ''): Promise<string[]> {
    const files: string[] = []
    for await (const [name, handle] of (dir as any).entries()) {
        const path = prefix ? `${prefix}/${name}` : name
        if (handle.kind === 'file') {
            files.push(path)
        } else if (handle.kind === 'directory') {
            const subFiles = await listFilesRecursive(handle, path)
            files.push(...subFiles)
        }
    }
    return files
}

// 재귀적으로 모든 파일 경로와 크기를 수집
async function listFilesWithSizesRecursive(dir: FileSystemDirectoryHandle, prefix: string = ''): Promise<{ path: string; size: number }[]> {
    const files: { path: string; size: number }[] = []
    for await (const [name, handle] of (dir as any).entries()) {
        const path = prefix ? `${prefix}/${name}` : name
        if (handle.kind === 'file') {
            try {
                const fileHandle = handle as FileSystemFileHandleWithSync
                const accessHandle = await fileHandle.createSyncAccessHandle()
                const size = accessHandle.getSize()
                accessHandle.close()
                files.push({ path, size })
            } catch {
                files.push({ path, size: 0 })
            }
        } else if (handle.kind === 'directory') {
            const subFiles = await listFilesWithSizesRecursive(handle, path)
            files.push(...subFiles)
        }
    }
    return files
}

// 디렉토리를 재귀적으로 삭제
async function deleteDirectoryRecursive(parentDir: FileSystemDirectoryHandle, dirName: string): Promise<void> {
    await parentDir.removeEntry(dirName, { recursive: true })
}

self.onmessage = async (e: MessageEvent<SaveMessage | LoadMessage | ListMessage | ListWithSizesMessage | DeleteMessage | ListRecursiveMessage | ListWithSizesRecursiveMessage | DeleteDirectoryMessage>) => {
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
    } else if (type === 'listWithSizes') {
        const { dirPath } = e.data as ListWithSizesMessage
        try {
            const dir = dirPath ? await getDirectory(dirPath) : await getRoot()
            if (!dir) {
                const response: ListWithSizesResponse = {
                    type: 'listWithSizes_success',
                    dirPath,
                    files: []
                }
                self.postMessage(response)
                return
            }

            const files: { name: string; size: number }[] = []
            for await (const [name, handle] of (dir as any).entries()) {
                if (handle.kind === 'file') {
                    try {
                        const fileHandle = handle as FileSystemFileHandleWithSync
                        const accessHandle = await fileHandle.createSyncAccessHandle()
                        const size = accessHandle.getSize()
                        accessHandle.close()
                        files.push({ name, size })
                    } catch {
                        // 파일 크기를 읽을 수 없으면 0으로 처리
                        files.push({ name, size: 0 })
                    }
                }
            }

            const response: ListWithSizesResponse = { type: 'listWithSizes_success', dirPath, files }
            self.postMessage(response)
        } catch (error) {
            const response: ListWithSizesResponse = {
                type: 'listWithSizes_error',
                dirPath,
                error: error instanceof Error ? error.message : String(error)
            }
            self.postMessage(response)
        }
    } else if (type === 'delete') {
        const { key } = e.data as DeleteMessage
        try {
            const parts = key.split('/')
            const fileName = parts.pop()!
            const dirPath = parts.join('/')

            const dir = dirPath ? await getDirectory(dirPath) : await getRoot()
            if (!dir) {
                // 디렉토리가 없으면 파일도 없는 것이므로 성공 처리
                const response: DeleteResponse = { type: 'delete_success', key }
                self.postMessage(response)
                return
            }

            await dir.removeEntry(fileName)

            const response: DeleteResponse = { type: 'delete_success', key }
            self.postMessage(response)
        } catch (error) {
            // 파일이 없어도 성공으로 처리 (이미 삭제된 상태)
            if (error instanceof Error && error.name === 'NotFoundError') {
                const response: DeleteResponse = { type: 'delete_success', key }
                self.postMessage(response)
                return
            }
            const response: DeleteResponse = {
                type: 'delete_error',
                key,
                error: error instanceof Error ? error.message : String(error)
            }
            self.postMessage(response)
        }
    } else if (type === 'listRecursive') {
        const { dirPath } = e.data as ListRecursiveMessage
        try {
            const dir = dirPath ? await getDirectory(dirPath) : await getRoot()
            if (!dir) {
                const response: ListRecursiveResponse = {
                    type: 'listRecursive_success',
                    dirPath,
                    files: []
                }
                self.postMessage(response)
                return
            }

            const files = await listFilesRecursive(dir)
            const response: ListRecursiveResponse = { type: 'listRecursive_success', dirPath, files }
            self.postMessage(response)
        } catch (error) {
            const response: ListRecursiveResponse = {
                type: 'listRecursive_error',
                dirPath,
                error: error instanceof Error ? error.message : String(error)
            }
            self.postMessage(response)
        }
    } else if (type === 'listWithSizesRecursive') {
        const { dirPath } = e.data as ListWithSizesRecursiveMessage
        try {
            const dir = dirPath ? await getDirectory(dirPath) : await getRoot()
            if (!dir) {
                const response: ListWithSizesRecursiveResponse = {
                    type: 'listWithSizesRecursive_success',
                    dirPath,
                    files: []
                }
                self.postMessage(response)
                return
            }

            const files = await listFilesWithSizesRecursive(dir)
            const response: ListWithSizesRecursiveResponse = { type: 'listWithSizesRecursive_success', dirPath, files }
            self.postMessage(response)
        } catch (error) {
            const response: ListWithSizesRecursiveResponse = {
                type: 'listWithSizesRecursive_error',
                dirPath,
                error: error instanceof Error ? error.message : String(error)
            }
            self.postMessage(response)
        }
    } else if (type === 'deleteDirectory') {
        const { dirPath } = e.data as DeleteDirectoryMessage
        try {
            const parts = dirPath.split('/').filter(p => p)
            if (parts.length === 0) {
                // 루트 삭제는 허용하지 않음
                const response: DeleteDirectoryResponse = {
                    type: 'deleteDirectory_error',
                    dirPath,
                    error: 'Cannot delete root directory'
                }
                self.postMessage(response)
                return
            }

            const dirName = parts.pop()!
            const parentPath = parts.join('/')
            const parentDir = parentPath ? await getDirectory(parentPath) : await getRoot()

            if (!parentDir) {
                // 부모 디렉토리가 없으면 이미 삭제된 것으로 성공 처리
                const response: DeleteDirectoryResponse = { type: 'deleteDirectory_success', dirPath }
                self.postMessage(response)
                return
            }

            await deleteDirectoryRecursive(parentDir, dirName)
            const response: DeleteDirectoryResponse = { type: 'deleteDirectory_success', dirPath }
            self.postMessage(response)
        } catch (error) {
            // 디렉토리가 없어도 성공으로 처리 (이미 삭제된 상태)
            if (error instanceof Error && error.name === 'NotFoundError') {
                const response: DeleteDirectoryResponse = { type: 'deleteDirectory_success', dirPath }
                self.postMessage(response)
                return
            }
            const response: DeleteDirectoryResponse = {
                type: 'deleteDirectory_error',
                dirPath,
                error: error instanceof Error ? error.message : String(error)
            }
            self.postMessage(response)
        }
    }
}

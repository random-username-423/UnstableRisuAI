/**
 * OPFS Worker Client
 * Worker와 통신하는 클라이언트 코드
 * Worker 본체는 opfsSaveWorker.ts에 있음
 */

import { isNodeServer } from "src/ts/utils/env"
import { AutoStorage } from "./autoStorage"

// Fallback용 storage
const forageStorage = new AutoStorage()

// OPFS Worker (DB 저장 전용, 메인 스레드 블로킹 방지)
// 에셋 파일은 forageStorage(IndexedDB)를 직접 사용
let opfsWorker: Worker | null = null
let opfsWorkerReady = false
const pendingSaves = new Map<string, { resolve: () => void, reject: (e: Error) => void }>()
const pendingLoads = new Map<string, { resolve: (data: Uint8Array | null) => void, reject: (e: Error) => void }>()
const pendingLists = new Map<string, { resolve: (files: string[]) => void, reject: (e: Error) => void }>()
const pendingListsWithSizes = new Map<string, { resolve: (files: { name: string; size: number }[]) => void, reject: (e: Error) => void }>()
const pendingDeletes = new Map<string, { resolve: () => void, reject: (e: Error) => void }>()
const pendingListsRecursive = new Map<string, { resolve: (files: string[]) => void, reject: (e: Error) => void }>()
const pendingListsWithSizesRecursive = new Map<string, { resolve: (files: { path: string; size: number }[]) => void, reject: (e: Error) => void }>()
const pendingDeleteDirectories = new Map<string, { resolve: () => void, reject: (e: Error) => void }>()
const pendingListEntries = new Map<string, { resolve: (entries: { name: string; size: number; isDirectory: boolean }[]) => void, reject: (e: Error) => void }>()

export class OPFSNotSupportedError extends Error {
    constructor() {
        super('OPFS is not supported in this browser')
        this.name = 'OPFSNotSupportedError'
    }
}

export class OPFSInitializationError extends Error {
    constructor(cause?: Error) {
        super('Failed to initialize OPFS Worker')
        this.name = 'OPFSInitializationError'
        this.cause = cause
    }
}

export async function initOPFSWorker(): Promise<void> {
    if (opfsWorker || isNodeServer) return

    // OPFS 지원 여부 체크 (실제 호출로 확인)
    try {
        await navigator.storage.getDirectory()
    } catch (e) {
        throw new OPFSNotSupportedError()
    }

    // Worker 초기화
    try {
        // Vite의 ?worker 쿼리로 Worker 번들링
        // Tauri와 Web 모두 OPFS Worker 사용 (DB 저장용)
        const OPFSWorker = await import('./opfsSaveWorker?worker')
        opfsWorker = new OPFSWorker.default()

        // Worker ready 신호를 기다림 (5초 타임아웃)
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('OPFS Worker initialization timeout'))
            }, 5000)

            const readyHandler = (e: MessageEvent) => {
                if (e.data.type === 'ready') {
                    clearTimeout(timeout)
                    opfsWorkerReady = true
                    resolve()
                }
            }
            opfsWorker!.addEventListener('message', readyHandler, { once: true })
        })

    opfsWorker.onmessage = (e) => {
        const { type, key, error, data } = e.data

        // Handle save responses
        if (type === 'success' || type === 'error') {
            const pending = pendingSaves.get(key)
            if (pending) {
                if (type === 'success') {
                    pending.resolve()
                } else {
                    pending.reject(new Error(error || 'Unknown save error'))
                }
                pendingSaves.delete(key)
            }
        }
        // Handle load responses
        else if (type === 'load_success' || type === 'load_error') {
            const pending = pendingLoads.get(key)
            if (pending) {
                if (type === 'load_success') {
                    pending.resolve(data || null)
                } else {
                    // File not found is not an error, just return null
                    pending.resolve(null)
                }
                pendingLoads.delete(key)
            }
        }
        // Handle list responses
        else if (type === 'list_success' || type === 'list_error') {
            const { dirPath, files } = e.data
            const pending = pendingLists.get(dirPath)
            if (pending) {
                if (type === 'list_success') {
                    pending.resolve(files || [])
                } else {
                    pending.resolve([])
                }
                pendingLists.delete(dirPath)
            }
        }
        // Handle listWithSizes responses
        else if (type === 'listWithSizes_success' || type === 'listWithSizes_error') {
            const { dirPath, files } = e.data
            const pending = pendingListsWithSizes.get(dirPath)
            if (pending) {
                if (type === 'listWithSizes_success') {
                    pending.resolve(files || [])
                } else {
                    pending.resolve([])
                }
                pendingListsWithSizes.delete(dirPath)
            }
        }
        // Handle delete responses
        else if (type === 'delete_success' || type === 'delete_error') {
            const pending = pendingDeletes.get(key)
            if (pending) {
                if (type === 'delete_success') {
                    pending.resolve()
                } else {
                    pending.reject(new Error(error || 'Unknown delete error'))
                }
                pendingDeletes.delete(key)
            }
        }
        // Handle listRecursive responses
        else if (type === 'listRecursive_success' || type === 'listRecursive_error') {
            const { dirPath, files } = e.data
            const pending = pendingListsRecursive.get(dirPath)
            if (pending) {
                if (type === 'listRecursive_success') {
                    pending.resolve(files || [])
                } else {
                    pending.resolve([])
                }
                pendingListsRecursive.delete(dirPath)
            }
        }
        // Handle listWithSizesRecursive responses
        else if (type === 'listWithSizesRecursive_success' || type === 'listWithSizesRecursive_error') {
            const { dirPath, files } = e.data
            const pending = pendingListsWithSizesRecursive.get(dirPath)
            if (pending) {
                if (type === 'listWithSizesRecursive_success') {
                    pending.resolve(files || [])
                } else {
                    pending.resolve([])
                }
                pendingListsWithSizesRecursive.delete(dirPath)
            }
        }
        // Handle deleteDirectory responses
        else if (type === 'deleteDirectory_success' || type === 'deleteDirectory_error') {
            const { dirPath } = e.data
            const pending = pendingDeleteDirectories.get(dirPath)
            if (pending) {
                if (type === 'deleteDirectory_success') {
                    pending.resolve()
                } else {
                    pending.reject(new Error(error || 'Unknown delete directory error'))
                }
                pendingDeleteDirectories.delete(dirPath)
            }
        }
        // Handle listEntries responses
        else if (type === 'listEntries_success' || type === 'listEntries_error') {
            const { dirPath, entries } = e.data
            const pending = pendingListEntries.get(dirPath)
            if (pending) {
                if (type === 'listEntries_success') {
                    pending.resolve(entries || [])
                } else {
                    pending.resolve([])
                }
                pendingListEntries.delete(dirPath)
            }
        }
    }
    opfsWorker.onerror = (e) => {
        console.error('OPFS worker error:', e)
    }
    console.log('[OPFS] Worker initialized successfully')
} catch (e) {
        opfsWorker = null
        opfsWorkerReady = false
        throw new OPFSInitializationError(e instanceof Error ? e : undefined)
    }
}

// 파일별 저장 큐 (같은 파일에 대한 동시 쓰기 방지)
const saveQueues = new Map<string, Promise<void>>()

export async function saveToWorker(key: string, data: Uint8Array<ArrayBuffer>): Promise<void> {
    // 이전 요청이 끝날 때까지 대기 후 실행 (같은 파일만)
    const prev = saveQueues.get(key) ?? Promise.resolve()

    const current = prev.then(() => doActualSave(key, data))
    saveQueues.set(key, current)

    return current
}

async function doActualSave(key: string, data: Uint8Array<ArrayBuffer>): Promise<void> {
    // Worker가 없으면 자동 초기화 (백업 복원 시에도 OPFS 사용)
    if (!opfsWorker) {
        await initOPFSWorker()
    }
    if (!opfsWorker) {
        // Worker 초기화 실패 시 Fallback to main thread
        await forageStorage.setItem(key, data)
        return
    }
    return new Promise((resolve, reject) => {
        pendingSaves.set(key, { resolve, reject })
        // Transferable로 전달하여 제로카피
        opfsWorker.postMessage({ type: 'save', key, data }, [data.buffer])
    })
}

export async function loadFromWorker(key: string): Promise<Uint8Array | null> {
    // Worker가 없으면 자동 초기화
    if (!opfsWorker) {
        await initOPFSWorker()
    }
    if (!opfsWorker) {
        return null
    }
    return new Promise((resolve, reject) => {
        pendingLoads.set(key, { resolve, reject })
        opfsWorker.postMessage({ type: 'load', key })
    })
}

export async function listFromWorker(dirPath: string): Promise<string[]> {
    // Worker가 없으면 자동 초기화
    if (!opfsWorker) {
        await initOPFSWorker()
    }
    if (!opfsWorker) {
        return []
    }
    return new Promise((resolve, reject) => {
        pendingLists.set(dirPath, { resolve, reject })
        opfsWorker.postMessage({ type: 'list', dirPath })
    })
}

export async function listWithSizesFromWorker(dirPath: string): Promise<{ name: string; size: number }[]> {
    // Worker가 없으면 자동 초기화
    if (!opfsWorker) {
        await initOPFSWorker()
    }
    if (!opfsWorker) {
        return []
    }
    return new Promise((resolve, reject) => {
        pendingListsWithSizes.set(dirPath, { resolve, reject })
        opfsWorker.postMessage({ type: 'listWithSizes', dirPath })
    })
}

export async function deleteFromWorker(key: string): Promise<void> {
    // Worker가 없으면 자동 초기화
    if (!opfsWorker) {
        await initOPFSWorker()
    }
    if (!opfsWorker) {
        return
    }
    return new Promise((resolve, reject) => {
        pendingDeletes.set(key, { resolve, reject })
        opfsWorker.postMessage({ type: 'delete', key })
    })
}

/**
 * Worker가 준비되었는지 확인
 */
export function isWorkerReady(): boolean {
    return opfsWorker !== null && opfsWorkerReady
}

/**
 * 재귀적으로 디렉토리 내 모든 파일 목록 조회 (하위 디렉토리 포함)
 * 반환값은 상대 경로 (예: "chaId/chatId.bin")
 */
export async function listRecursiveFromWorker(dirPath: string): Promise<string[]> {
    if (!opfsWorker) {
        await initOPFSWorker()
    }
    if (!opfsWorker) {
        return []
    }
    return new Promise((resolve, reject) => {
        pendingListsRecursive.set(dirPath, { resolve, reject })
        opfsWorker.postMessage({ type: 'listRecursive', dirPath })
    })
}

/**
 * 재귀적으로 디렉토리 내 모든 파일 목록과 크기 조회 (하위 디렉토리 포함)
 * 반환값은 상대 경로 (예: { path: "chaId/chatId.bin", size: 1234 })
 */
export async function listWithSizesRecursiveFromWorker(dirPath: string): Promise<{ path: string; size: number }[]> {
    if (!opfsWorker) {
        await initOPFSWorker()
    }
    if (!opfsWorker) {
        return []
    }
    return new Promise((resolve, reject) => {
        pendingListsWithSizesRecursive.set(dirPath, { resolve, reject })
        opfsWorker.postMessage({ type: 'listWithSizesRecursive', dirPath })
    })
}

/**
 * 디렉토리와 그 안의 모든 파일/하위 디렉토리를 재귀적으로 삭제
 */
export async function deleteDirectoryFromWorker(dirPath: string): Promise<void> {
    if (!opfsWorker) {
        await initOPFSWorker()
    }
    if (!opfsWorker) {
        return
    }
    return new Promise((resolve, reject) => {
        pendingDeleteDirectories.set(dirPath, { resolve, reject })
        opfsWorker.postMessage({ type: 'deleteDirectory', dirPath })
    })
}

/**
 * 디렉토리 내 모든 항목(파일+디렉토리) 목록과 크기 조회
 * OPFS 탐색기용
 */
export async function listEntriesFromWorker(dirPath: string): Promise<{ name: string; size: number; isDirectory: boolean }[]> {
    if (!opfsWorker) {
        await initOPFSWorker()
    }
    if (!opfsWorker) {
        return []
    }
    return new Promise((resolve, reject) => {
        pendingListEntries.set(dirPath, { resolve, reject })
        opfsWorker.postMessage({ type: 'listEntries', dirPath })
    })
}

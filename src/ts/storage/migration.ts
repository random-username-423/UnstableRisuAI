/**
 * Storage migration functions.
 * These handle legacy data migration when storage architecture changes.
 */

import { exists, readDir, readFile, remove, BaseDirectory } from '@tauri-apps/plugin-fs'
import { alertWait } from '../alert'
import {
    isTauri,
    forageStorage,
    initOPFSWorker,
    listFromWorker,
    loadFromWorker,
    deleteFromWorker,
    saveToWorker
} from '../globalApi.svelte'

/**
 * Migrates assets from OPFS to IndexedDB (forageStorage).
 * Called once on app startup if OPFS assets folder has files.
 */
export async function migrateOPFSAssetsToIndexedDB(): Promise<void> {
    if (!isTauri) return

    // OPFS Worker 초기화
    await initOPFSWorker()

    // OPFS에서 에셋 목록 가져오기 (폴더가 비어있으면 마이그레이션 불필요)
    const opfsAssets = await listFromWorker('assets')
    if (opfsAssets.length === 0) return

    console.log(`[Migration] Starting OPFS → IndexedDB migration for ${opfsAssets.length} assets`)
    alertWait(`에셋 마이그레이션 중... (0 / ${opfsAssets.length})`)

    for (let i = 0; i < opfsAssets.length; i++) {
        const name = opfsAssets[i]
        alertWait(`에셋 마이그레이션 중... (${i + 1} / ${opfsAssets.length})`)

        const data = await loadFromWorker('assets/' + name)
        if (data) {
            await forageStorage.setItem('assets/' + name, data)
        }
    }

    console.log('[Migration] OPFS → IndexedDB migration completed')

    // OPFS 에셋 삭제 (공간 확보)
    alertWait('OPFS 정리 중...')
    for (const name of opfsAssets) {
        await deleteFromWorker('assets/' + name)
    }
    console.log('[Migration] OPFS assets cleaned up')
}

/**
 * Migrates assets from Tauri fs (AppData) to IndexedDB (forageStorage).
 * Called once on app startup if not already migrated.
 * This handles legacy data from before the storage architecture change.
 */
export async function migrateTauriFsAssetsToIndexedDB(): Promise<void> {
    if (!isTauri) return

    // Tauri fs에 assets 폴더가 있는지 확인 (폴더가 없으면 마이그레이션 불필요)
    try {
        const assetsExist = await exists('assets', { baseDir: BaseDirectory.AppData })
        if (!assetsExist) return

        const assets = await readDir('assets', { baseDir: BaseDirectory.AppData })
        if (assets.length === 0) {
            // 빈 폴더면 삭제하고 종료
            await remove('assets', { baseDir: BaseDirectory.AppData, recursive: true })
            return
        }

        console.log(`[Migration] Starting Tauri fs → IndexedDB migration for ${assets.length} assets`)
        alertWait(`Tauri fs 에셋 마이그레이션 중... (0 / ${assets.length})`)

        let migratedCount = 0
        for (let i = 0; i < assets.length; i++) {
            const asset = assets[i]
            if (!asset.name || asset.isDirectory) continue

            alertWait(`Tauri fs 에셋 마이그레이션 중... (${i + 1} / ${assets.length})`)

            const key = 'assets/' + asset.name

            // Tauri fs에서 읽어서 IndexedDB에 저장
            try {
                const data = await readFile('assets/' + asset.name, { baseDir: BaseDirectory.AppData })
                if (data && data.byteLength > 0) {
                    // IndexedDB에 이미 있는지 확인
                    const existing = await forageStorage.getItem(key)
                    if (!existing) {
                        await forageStorage.setItem(key, data)
                        migratedCount++
                    }
                }
            } catch (e) {
                console.warn(`[Migration] Failed to migrate asset: ${asset.name}`, e)
            }
        }

        // 마이그레이션 완료 후 assets 폴더 삭제
        await remove('assets', { baseDir: BaseDirectory.AppData, recursive: true })
        console.log(`[Migration] Tauri fs → IndexedDB migration completed (${migratedCount} assets migrated)`)
    } catch (e) {
        console.warn('[Migration] Tauri fs migration failed:', e)
    }
}

/**
 * 웹에서 IndexedDB의 DB를 OPFS로 마이그레이션
 * 에셋은 IndexedDB에 유지, DB만 OPFS로 이동
 */
export async function migrateWebDBtoOPFS(): Promise<void> {
    if (isTauri) return

    // 이미 마이그레이션 완료 체크
    const migrationDone = await loadFromWorker('__web_db_migration_done__')
    if (migrationDone) return

    // IndexedDB에서 DB 확인
    const indexedDBData = await forageStorage.getItem('database/database.bin') as unknown as Uint8Array
    if (!indexedDBData) {
        // IndexedDB에 DB가 없으면 마이그레이션 완료로 표시
        await saveToWorker('__web_db_migration_done__', new Uint8Array([1]))
        return
    }

    console.log('[Migration] Starting Web IndexedDB → OPFS migration for DB')
    alertWait('DB 마이그레이션 중...')

    // DB를 OPFS로 복사
    await saveToWorker('database/database.bin', indexedDBData)

    // 백업 파일들도 마이그레이션
    const keys = await forageStorage.keys()
    const backupKeys = keys.filter(k => k.startsWith('database/dbbackup-'))
    for (const key of backupKeys) {
        const backupData = await forageStorage.getItem(key) as unknown as Uint8Array
        if (backupData) {
            await saveToWorker(key, backupData)
        }
    }

    // 마이그레이션 완료 플래그 저장
    await saveToWorker('__web_db_migration_done__', new Uint8Array([1]))
    console.log('[Migration] Web IndexedDB → OPFS migration completed')

    // IndexedDB에서 DB 삭제 (공간 확보)
    await forageStorage.removeItem('database/database.bin')
    for (const key of backupKeys) {
        await forageStorage.removeItem(key)
    }
    console.log('[Migration] IndexedDB DB cleaned up')
}

/**
 * Run all necessary migrations based on environment
 */
export async function runMigrations(): Promise<void> {
    if (isTauri) {
        await migrateOPFSAssetsToIndexedDB()
        await migrateTauriFsAssetsToIndexedDB()
    } else {
        await migrateWebDBtoOPFS()
    }
}

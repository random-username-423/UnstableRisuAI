import { alertError, alertNormal, alertStore, alertWait, alertMd, waitAlert, alertClear, alertSelect } from "../../utils/alert";
import { Buffer } from "buffer";
import { saving, requiresFullEncoderReload } from "src/ts/data/storage/autoSaveManager.svelte";
import { forageStorage } from "src/ts/data/storage/autoStorage";
import { LocalWriter } from "src/ts/utils/writers";
import { saveToWorker, listFromWorker, listRecursiveFromWorker, deleteFromWorker, deleteDirectoryFromWorker, loadFromWorker } from 'src/ts/data/storage/opfsWorkerClient.svelte'
import { isTauri } from "src/ts/utils/env";
import { decodeRisuSave, encodeRisuSaveLegacy } from "../storage/risuSave";
import { getDatabase, setDatabaseLite, setDatabase } from "../storage/database.svelte";
import { relaunch } from "@tauri-apps/plugin-process";
import { platform } from "@tauri-apps/plugin-os";
import { sleep } from '../../utils/util';
import { readDir, readFile, BaseDirectory, exists } from "@tauri-apps/plugin-fs";

export async function SaveLocalBackup(){
    alertWait("Saving local backup...")
    const writer = new LocalWriter()
    const r = await writer.init()
    if(!r){
        alertError('Failed')
        return
    }

    const db = getDatabase()

    const assetMap = new Map<string, { charName: string, assetName: string }>()
    if (db.characters) {
        for (const char of db.characters) {
            if (!char) continue
            const charName = char.name ?? 'Unknown Character'
            
            if (char.image) assetMap.set(char.image, { charName: charName, assetName: 'Main Image' })
            
            if (char.emotionImages) {
                for (const em of char.emotionImages) {
                    if (em && em[1]) assetMap.set(em[1], { charName: charName, assetName: em[0] })
                }
            }
            if (char.type !== 'group') {
                if (char.additionalAssets) {
                    for (const em of char.additionalAssets) {
                        if (em && em[1]) assetMap.set(em[1], { charName: charName, assetName: em[0] })
                    }
                }
                if (char.vits) {
                    const keys = Object.keys(char.vits.files)
                    for (const key of keys) {
                        const vit = char.vits.files[key]
                        if (vit) assetMap.set(vit, { charName: charName, assetName: key })
                    }
                }
                if (char.ccAssets) {
                    for (const asset of char.ccAssets) {
                        if (asset && asset.uri) assetMap.set(asset.uri, { charName: charName, assetName: asset.name })
                    }
                }
            }
        }
    }
    if (db.userIcon) {
        assetMap.set(db.userIcon, { charName: 'User Settings', assetName: 'User Icon' })
    }
    if (db.customBackground) {
        assetMap.set(db.customBackground, { charName: 'User Settings', assetName: 'Custom Background' })
    }
    const missingAssets: string[] = []
    const writtenAssets = new Set<string>()  // 중복 방지

    // 1. IndexedDB (forageStorage)에서 에셋 수집
    const keys = await forageStorage.keys()
    const indexedDbAssetKeys = keys.filter(key => key && key.startsWith('assets/'))
    console.log(`[LocalBackup] Found ${indexedDbAssetKeys.length} assets in IndexedDB`)

    // 2. Tauri fs (AppData/assets)에서 에셋 수집 (레거시 데이터 호환)
    let tauriFsAssetKeys: string[] = []
    if (isTauri) {
        try {
            const assetsExist = await exists('assets', { baseDir: BaseDirectory.AppData })
            if (assetsExist) {
                const tauriFsAssets = await readDir('assets', { baseDir: BaseDirectory.AppData })
                tauriFsAssetKeys = tauriFsAssets
                    .filter(a => a.name && !a.isDirectory)
                    .map(a => 'assets/' + a.name)
                console.log(`[LocalBackup] Found ${tauriFsAssetKeys.length} assets in Tauri fs`)
            }
        } catch (e) {
            console.warn('[LocalBackup] Failed to read Tauri fs assets:', e)
        }
    }

    // 전체 에셋 목록 (중복 제거)
    const allAssetKeys = [...new Set([...indexedDbAssetKeys, ...tauriFsAssetKeys])]
    console.log(`[LocalBackup] Total unique assets to backup: ${allAssetKeys.length}`)

    for(let i = 0; i < allAssetKeys.length; i++){
        const key = allAssetKeys[i]
        let message = `Saving local Backup... (${i + 1} / ${allAssetKeys.length})`
        if (missingAssets.length > 0) {
            const skippedItems = missingAssets.map(k => {
                const assetInfo = assetMap.get(k);
                return assetInfo ? `'${assetInfo.assetName}' from ${assetInfo.charName}` : `'${k}'`;
            }).join(', ');
            message += `\n(Skipping... ${skippedItems})`;
        }
        alertWait(message)

        // 먼저 IndexedDB에서 시도
        let data = await forageStorage.getItem(key) as unknown as Uint8Array

        // IndexedDB에 없으면 Tauri fs에서 시도
        if (!data && isTauri && tauriFsAssetKeys.includes(key)) {
            try {
                data = await readFile(key, { baseDir: BaseDirectory.AppData })
            } catch (e) {
                // 무시
            }
        }

        if (data && data.byteLength > 0) {
            await writer.writeBackup(key, data)
            writtenAssets.add(key)
        } else {
            missingAssets.push(key)
        }
        if(forageStorage.isAccount){
            await sleep(1000)
        }
    }

    // Backup chat files from OPFS (one by one to avoid memory issues)
    // Uses listRecursiveFromWorker for nested directory structure (chaId/chatId.bin)
    try {
        const chatFiles = await listRecursiveFromWorker('database/chats')
        console.log(`[LocalBackup] Found ${chatFiles.length} chat files to backup`)
        for (let i = 0; i < chatFiles.length; i++) {
            const file = chatFiles[i]  // 상대 경로: "chaId/chatId.bin"
            alertWait(`Saving local Backup... (Chat ${i + 1}/${chatFiles.length})`)
            try {
                const data = await loadFromWorker(`database/chats/${file}`)
                if (data && data.byteLength > 0) {
                    await writer.writeBackup(`chats/${file}`, data)
                }
            } catch (e) {
                console.warn(`[LocalBackup] Failed to backup chat file ${file}:`, e)
            }
        }
        console.log(`[LocalBackup] Backed up ${chatFiles.length} chat files`)
    } catch (e) {
        console.log('[LocalBackup] No chat files to backup or error:', e)
    }

    const dbData = encodeRisuSaveLegacy(getDatabase(), 'compression')

    alertWait(`Saving local Backup... (Saving database)`) 

    await writer.writeBackup('database.risudat', dbData)
    await writer.close()

    if (missingAssets.length > 0) {
        let message = 'Backup Successful, but the following assets were missing and skipped:\n\n'
        for (const key of missingAssets) {
            const assetInfo = assetMap.get(key)
            if (assetInfo) {
                message += `* **${assetInfo.assetName}** (from *${assetInfo.charName}*)  \n  *File: ${key}*\n`
            } else {
                message += `* **Unknown Asset**  \n  *File: ${key}*\n`
            }
        }
        alertMd(message)
    } else {
        alertNormal('Success')
    }
}

/**
 * Opens a file picker dialog and returns the selected file.
 */
async function selectBackupFile(): Promise<File | null> {
    return new Promise((resolve) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.bin'
        input.onchange = () => {
            const file = input.files?.[0] ?? null
            input.remove()
            resolve(file)
        }
        input.click()
    })
}

interface BackupItem {
    name: string
    data: Uint8Array<ArrayBuffer>
}

interface ParseProgress {
    bytesRead: number
    fileSize: number
    itemCount: number
}

/**
 * Parses a backup file stream and yields individual backup items.
 */
async function* parseBackupStream(
    file: File,
    onProgress?: (progress: ParseProgress) => void
): AsyncGenerator<BackupItem> {
    const reader = file.stream().getReader()
    let bytesRead = 0
    let remainingBuffer = new Uint8Array()
    let itemCount = 0

    while (true) {
        const { done, value } = await reader.read()
        if (done) break

        bytesRead += value.length
        onProgress?.({ bytesRead, fileSize: file.size, itemCount })

        // Append new data to remaining buffer
        const newBuffer = new Uint8Array(remainingBuffer.length + value.length)
        newBuffer.set(remainingBuffer)
        newBuffer.set(value, remainingBuffer.length)
        remainingBuffer = newBuffer

        // Parse complete items from buffer
        let offset = 0
        while (offset + 4 <= remainingBuffer.length) {
            const nameLength = new Uint32Array(remainingBuffer.slice(offset, offset + 4).buffer)[0]
            if (offset + 4 + nameLength > remainingBuffer.length) break

            const nameBuffer = remainingBuffer.slice(offset + 4, offset + 4 + nameLength)
            const name = new TextDecoder().decode(nameBuffer)

            if (offset + 4 + nameLength + 4 > remainingBuffer.length) break

            const dataLength = new Uint32Array(
                remainingBuffer.slice(offset + 4 + nameLength, offset + 4 + nameLength + 4).buffer
            )[0]

            if (offset + 4 + nameLength + 4 + dataLength > remainingBuffer.length) break

            const data = remainingBuffer.slice(
                offset + 4 + nameLength + 4,
                offset + 4 + nameLength + 4 + dataLength
            )

            itemCount++
            yield { name, data: new Uint8Array(data) as Uint8Array<ArrayBuffer> }

            offset += 4 + nameLength + 4 + dataLength
        }

        remainingBuffer = remainingBuffer.slice(offset)
    }
}

/**
 * Restores the database from backup data and restarts the app.
 */
async function restoreDatabase(data: Uint8Array<ArrayBuffer>, hasChatsFiles: boolean): Promise<void> {
    console.log('[LoadLocalBackup] Found database.risudat, processing...')

    saving.paused = true

    alertWait('Loading local Backup... (Decoding database...)')
    const dbData = await decodeRisuSave(data)
    console.log('[LoadLocalBackup] Database decoded')
    setDatabaseLite(dbData)
    requiresFullEncoderReload.state = true

    // Clear existing separated files
    alertWait('Loading local Backup... (Clearing old files...)')

    try {
        await deleteFromWorker('database/characters.bin')
        console.log('[LoadLocalBackup] Cleared characters.bin')
    } catch {
        console.log('[LoadLocalBackup] No characters.bin to clear')
    }

    try {
        await deleteFromWorker('database/botpresets.bin')
        console.log('[LoadLocalBackup] Cleared botpresets.bin')
    } catch {
        console.log('[LoadLocalBackup] No botpresets.bin to clear')
    }

    // Only delete chats directory if backup doesn't have separate chat files
    // If backup has chats/ files, they were already restored and should be kept
    if (!hasChatsFiles) {
        try {
            await deleteDirectoryFromWorker('database/chats')
            console.log('[LoadLocalBackup] Cleared chat files directory')
        } catch {
            console.log('[LoadLocalBackup] No chat files to clear')
        }
    }

    alertWait('Loading local Backup... (Saving database...)')
    await saveToWorker('database/database.bin', data)
    console.log('[LoadLocalBackup] Saved to OPFS worker')

    await restartApp()
}

/**
 * Restarts the app after backup restoration.
 */
async function restartApp(): Promise<void> {
    alertWait('Loading local Backup... (Restarting...)')

    if (isTauri) {
        const currentPlatform = await platform()
        console.log('[LoadLocalBackup] Platform:', currentPlatform)
        alertClear()
        await sleep(50)

        if (currentPlatform === 'android' || currentPlatform === 'ios') {
            alertNormal('Backup loaded successfully!\nPlease close and reopen the app.')
        } else {
            await relaunch()
        }
    } else {
        alertClear()
        await sleep(50)
        location.search = ''
    }
}

export async function LoadLocalBackup() {
    try {
        const file = await selectBackupFile()
        if (!file) return

        let itemCount = 0
        let hasChatsFiles = false
        let databaseItem: BackupItem | null = null

        const updateProgress = (progress: ParseProgress) => {
            const percent = ((progress.bytesRead / progress.fileSize) * 100).toFixed(2)
            alertWait(`Loading local Backup... (Reading: ${percent}% / Saved: ${itemCount} items)`)
        }

        for await (const item of parseBackupStream(file, updateProgress)) {
            if (item.name === 'database.risudat') {
                // Save for last - process after all other items
                databaseItem = item
                continue
            }

            if (item.name.startsWith('chats/')) {
                hasChatsFiles = true
                const chatFileName = item.name.slice(6) // Remove 'chats/' prefix
                await saveToWorker(`database/chats/${chatFileName}`, item.data)
                console.log(`[LoadLocalBackup] Restored chat file: ${chatFileName}`)
            } else {
                // Assets go to IndexedDB
                // Backward compatibility: old backups have filename only, new backups have full path
                const assetKey = item.name.startsWith('assets/') ? item.name : 'assets/' + item.name
                await forageStorage.setItem(assetKey, item.data)
            }

            itemCount++

            if (itemCount % 100 === 0) {
                await sleep(0) // Yield for UI updates
                if (forageStorage.isAccount) {
                    await sleep(1000)
                }
            }
        }

        // Process database last
        if (databaseItem) {
            await restoreDatabase(databaseItem.data, hasChatsFiles)
            return
        }

        alertNormal('Success')
    } catch (error) {
        console.error('[LoadLocalBackup] Error:', error)
        alertError(`Failed to load backup: ${error?.message || error}`)
    }
}

export async function loadInternalBackup(){
    // Both Tauri and web use OPFS for database storage now
    const files = await listFromWorker('database')
    let internalBackups:string[] = []
    for(const file of files){
        if(file.includes('dbbackup-')){
            internalBackups.push(file)
        }
    }

    const selectOptions = [
        'Cancel',
        ...(internalBackups.map((a) => {
            return (new Date(parseInt(a.replace('dbbackup-','')) * 100)).toLocaleString()
        }))
    ]

    const alertResult = parseInt(
        await alertSelect(selectOptions)
    ) - 1

    if(alertResult === -1){
        return
    }

    const selectedBackup = internalBackups[alertResult]

    const data = await loadFromWorker('database/' + selectedBackup)

    setDatabase(
        await decodeRisuSave(Buffer.from(data) as unknown as Uint8Array)
    )

    await alertNormal('Loaded backup')
}
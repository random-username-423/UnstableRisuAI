import { alertError, alertNormal, alertWait, alertMd, alertClear, alertSelect } from "src/ts/utils/alert.svelte"
import { Buffer } from "buffer"
import { saving, requiresFullEncoderReload } from "src/ts/data/storage/autoSaveManager.svelte"
import { forageStorage } from "src/ts/data/storage/autoStorage"
import { LocalWriter } from "src/ts/utils/writers"
import {
    saveToWorker,
    listFromWorker,
    listRecursiveFromWorker,
    deleteFromWorker,
    deleteDirectoryFromWorker,
    loadFromWorker,
} from "src/ts/data/storage/opfsWorkerClient.svelte"
import { isTauri } from "src/ts/utils/env"
import { decodeRisuSave, encodeRisuSaveLegacy, decodeChat } from "src/ts/data/storage/risuSave"
import { getDatabase, setDatabaseLite, setDatabase } from "src/ts/data/storage/database.svelte"
import { relaunch } from "@tauri-apps/plugin-process"
import { platform } from "@tauri-apps/plugin-os"
import { sleep } from "src/ts/utils/util"
import { readDir, readFile, BaseDirectory, exists } from "@tauri-apps/plugin-fs"
import type { Database, character, groupChat, Chat } from "src/ts/data/storage/types"

export async function SaveLocalBackup() {
    alertWait("Saving local backup...")
    const writer = new LocalWriter()
    const r = await writer.init()
    if (!r) {
        alertError("Failed")
        return
    }

    const db = getDatabase()

    const assetMap = new Map<string, { charName: string; assetName: string }>()
    if (db.characters) {
        for (const char of db.characters) {
            if (!char) continue
            const charName = char.name ?? "Unknown Character"

            if (char.image) assetMap.set(char.image, { charName: charName, assetName: "Main Image" })

            if (char.emotionImages) {
                for (const em of char.emotionImages) {
                    if (em && em[1]) assetMap.set(em[1], { charName: charName, assetName: em[0] })
                }
            }
            if (char.type !== "group") {
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
        assetMap.set(db.userIcon, { charName: "User Settings", assetName: "User Icon" })
    }
    if (db.customBackground) {
        assetMap.set(db.customBackground, { charName: "User Settings", assetName: "Custom Background" })
    }
    const missingAssets: string[] = []
    const writtenAssets = new Set<string>() // 중복 방지

    // 1. IndexedDB (forageStorage)에서 에셋 수집
    console.log(`[LocalBackup] forageStorage.isAccount: ${forageStorage.isAccount}`)
    const keys = await forageStorage.keys()
    console.log(`[LocalBackup] All keys count: ${keys.length}, first 10:`, keys.slice(0, 10))
    const indexedDbAssetKeys = keys.filter((key) => key && key.startsWith("assets/"))
    console.log(`[LocalBackup] Found ${indexedDbAssetKeys.length} assets in IndexedDB`)
    console.log(`[LocalBackup] First 10 IndexedDB keys:`, indexedDbAssetKeys.slice(0, 10))
    console.log(
        `[LocalBackup] AssetMap has ${assetMap.size} referenced assets. First 5:`,
        [...assetMap.keys()].slice(0, 5)
    )

    // 2. Tauri fs (AppData/assets)에서 에셋 수집 (레거시 데이터 호환)
    let tauriFsAssetKeys: string[] = []
    if (isTauri) {
        try {
            const assetsExist = await exists("assets", { baseDir: BaseDirectory.AppData })
            if (assetsExist) {
                const tauriFsAssets = await readDir("assets", { baseDir: BaseDirectory.AppData })
                tauriFsAssetKeys = tauriFsAssets.filter((a) => a.name && !a.isDirectory).map((a) => "assets/" + a.name)
                console.log(`[LocalBackup] Found ${tauriFsAssetKeys.length} assets in Tauri fs`)
            }
        } catch (e) {
            console.warn("[LocalBackup] Failed to read Tauri fs assets:", e)
        }
    }

    // DB에서 참조하는 에셋을 기준으로 백업 (assetMap 사용)
    const allAssetKeys = [...assetMap.keys()]
    console.log(`[LocalBackup] Total referenced assets to backup: ${allAssetKeys.length}`)

    for (let i = 0; i < allAssetKeys.length; i++) {
        const key = allAssetKeys[i]
        let message = `Saving local Backup... (${i + 1} / ${allAssetKeys.length})`
        if (missingAssets.length > 0) {
            const skippedItems = missingAssets
                .map((k) => {
                    const assetInfo = assetMap.get(k)
                    return assetInfo ? `'${assetInfo.assetName}' from ${assetInfo.charName}` : `'${k}'`
                })
                .join(", ")
            message += `\n(Skipping... ${skippedItems})`
        }
        alertWait(message)

        // 먼저 IndexedDB에서 시도
        let data = (await forageStorage.getItem(key)) as unknown as Uint8Array

        // IndexedDB에 없으면 Tauri fs에서 시도
        if (!data && isTauri && tauriFsAssetKeys.includes(key)) {
            try {
                data = await readFile(key, { baseDir: BaseDirectory.AppData })
            } catch (e) {
                // 무시
            }
        }

        // 여전히 없으면 서비스 워커 캐시에서 직접 시도 (웹 환경)
        if (!data && !isTauri && typeof caches !== "undefined") {
            try {
                const encoded = Buffer.from(key, "utf-8").toString("hex")
                const cache = await caches.open("risuCache")
                const cacheUrl = new URL("/sw/img/" + encoded, location.origin)
                const cachedResponse = await cache.match(cacheUrl)
                if (cachedResponse) {
                    const arrayBuffer = await cachedResponse.arrayBuffer()
                    data = new Uint8Array(arrayBuffer)
                    console.log(`[LocalBackup] Loaded from Cache API: ${key} (${data.byteLength} bytes)`)
                } else {
                    console.log(`[LocalBackup] Not in cache: ${key}`)
                }
            } catch (e) {
                console.log(`[LocalBackup] Cache API error for ${key}:`, e)
            }
        }

        if (data && data.byteLength > 0) {
            // Remove "assets/" prefix for backward compatibility with older versions
            const backupName = key.startsWith("assets/") ? key.slice(7) : key
            await writer.writeBackup(backupName, data)
            writtenAssets.add(key)
        } else {
            missingAssets.push(key)
        }
        if (forageStorage.isAccount) {
            await sleep(1000)
        }
    }

    // Backup chat files from OPFS (one by one to avoid memory issues)
    // Uses listRecursiveFromWorker for nested directory structure (chaId/chatId.bin)
    // TODO: 디버깅용 임시 스킵
    console.log(`[LocalBackup] SKIPPING chat backup for debugging`)
    // try {
    //     const chatFiles = await listRecursiveFromWorker("database/chats")
    //     console.log(`[LocalBackup] Found ${chatFiles.length} chat files to backup`)
    //     for (let i = 0; i < chatFiles.length; i++) {
    //         const file = chatFiles[i] // 상대 경로: "chaId/chatId.bin"
    //         alertWait(`Saving local Backup... (Chat ${i + 1}/${chatFiles.length})`)
    //         try {
    //             const data = await loadFromWorker(`database/chats/${file}`)
    //             if (data && data.byteLength > 0) {
    //                 await writer.writeBackup(`chats/${file}`, data)
    //             }
    //         } catch (e) {
    //             console.warn(`[LocalBackup] Failed to backup chat file ${file}:`, e)
    //         }
    //     }
    //     console.log(`[LocalBackup] Backed up ${chatFiles.length} chat files`)
    // } catch (e) {
    //     console.log("[LocalBackup] No chat files to backup or error:", e)
    // }

    const dbData = encodeRisuSaveLegacy(getDatabase(), "compression")

    alertWait(`Saving local Backup... (Saving database)`)

    await writer.writeBackup("database.risudat", dbData)
    await writer.close()

    if (missingAssets.length > 0) {
        let message = "Backup Successful, but the following assets were missing and skipped:\n\n"
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
        alertNormal("Success")
    }
}

/**
 * Opens a file picker dialog and returns the selected file.
 */
async function selectBackupFile(): Promise<File | null> {
    return new Promise((resolve) => {
        const input = document.createElement("input")
        input.type = "file"
        input.accept = ".bin"
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
 * Optimized to use a Chunk List approach to avoid O(N^2) memory copying.
 * Uses DataView for zero-copy header parsing and ensures safe data copying for yielded items.
 */
async function* parseBackupStream(
    file: File,
    onProgress?: (progress: ParseProgress) => void
): AsyncGenerator<BackupItem> {
    const reader = file.stream().getReader()
    let bytesReadFromFile = 0
    let itemCount = 0

    // Chunk List State
    const chunks: Uint8Array[] = []
    let totalLength = 0

    // Parsing State Machine
    let state: "NAME_LEN" | "NAME" | "DATA_LEN" | "DATA" = "NAME_LEN"
    let currentNameLen = 0
    let currentName = ""
    let currentDataLen = 0

    /**
     * Extracts `n` bytes from the front of the chunk list.
     * @param mode 'view' for zero-copy subarray (unsafe for long-term storage), 'copy' for new buffer (safe).
     */
    function extract(n: number, mode: "view" | "copy"): Uint8Array {
        if (totalLength < n) throw new Error("Internal Error: Not enough bytes to extract")

        // Optimization: The data is fully contained in the first chunk
        if (chunks[0].length >= n) {
            let val: Uint8Array
            if (mode === "copy") {
                val = chunks[0].slice(0, n) // Explicit copy
            } else {
                val = chunks[0].subarray(0, n) // Reference view
            }

            if (chunks[0].length === n) {
                chunks.shift() // Consume entire chunk
            } else {
                chunks[0] = chunks[0].subarray(n) // Consume part of chunk
            }
            totalLength -= n
            return val
        }

        // Slow path: Data spans multiple chunks, need to merge (always creates a new buffer)
        const res = new Uint8Array(n)
        let pos = 0
        while (pos < n) {
            const chunk = chunks[0]
            const remaining = n - pos
            const len = Math.min(chunk.length, remaining)

            res.set(chunk.subarray(0, len), pos)
            pos += len

            if (len === chunk.length) {
                chunks.shift()
            } else {
                chunks[0] = chunks[0].subarray(len)
            }
        }
        totalLength -= n
        return res
    }

    while (true) {
        const { done, value } = await reader.read()
        if (done) {
            if (totalLength > 0) {
                console.warn(
                    `[parseBackupStream] Stream ended with ${totalLength} bytes remaining. File might be corrupted.`
                )
            }
            break
        }

        chunks.push(value)
        totalLength += value.length
        bytesReadFromFile += value.length
        onProgress?.({ bytesRead: bytesReadFromFile, fileSize: file.size, itemCount })

        // Process loop: Consumes available data based on current state
        while (true) {
            if (state === "NAME_LEN") {
                if (totalLength < 4) break
                // Use 'view' mode for transient header parsing
                const bytes = extract(4, "view")
                // Use DataView for zero-copy integer reading
                currentNameLen = new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, true) // Little-endian
                state = "NAME"
            }

            if (state === "NAME") {
                if (totalLength < currentNameLen) break
                // Use 'view' mode for name decoding (TextDecoder handles views fine)
                const bytes = extract(currentNameLen, "view")
                currentName = new TextDecoder().decode(bytes)
                state = "DATA_LEN"
            }

            if (state === "DATA_LEN") {
                if (totalLength < 4) break
                const bytes = extract(4, "view")
                currentDataLen = new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, true)
                state = "DATA"
            }

            if (state === "DATA") {
                if (totalLength < currentDataLen) break
                // Use 'copy' mode for the actual data payload to ensure safe ownership
                const data = extract(currentDataLen, "copy")

                itemCount++
                yield { name: currentName, data: data as Uint8Array<ArrayBuffer> }

                // Reset for next item
                state = "NAME_LEN"
                currentNameLen = 0
                currentName = ""
                currentDataLen = 0
            }
        }
    }
}

/**
 * Restores the database from backup data and restarts the app.
 */
async function restoreDatabase(data: Uint8Array<ArrayBuffer>, hasChatsFiles: boolean): Promise<void> {
    console.log("[LoadLocalBackup] Found database.risudat, processing...")

    saving.paused = true

    alertWait("Loading local Backup... (Decoding database...)")
    const dbData = await decodeRisuSave(data)
    console.log("[LoadLocalBackup] Database decoded")
    setDatabaseLite(dbData)
    requiresFullEncoderReload.state = true

    // Clear existing separated files
    alertWait("Loading local Backup... (Clearing old files...)")

    try {
        await deleteFromWorker("database/characters.bin")
        console.log("[LoadLocalBackup] Cleared characters.bin")
    } catch {
        console.log("[LoadLocalBackup] No characters.bin to clear")
    }

    try {
        await deleteFromWorker("database/botpresets.bin")
        console.log("[LoadLocalBackup] Cleared botpresets.bin")
    } catch {
        console.log("[LoadLocalBackup] No botpresets.bin to clear")
    }

    // Only delete chats directory if backup doesn't have separate chat files
    // If backup has chats/ files, they were already restored and should be kept
    if (!hasChatsFiles) {
        try {
            await deleteDirectoryFromWorker("database/chats")
            console.log("[LoadLocalBackup] Cleared chat files directory")
        } catch {
            console.log("[LoadLocalBackup] No chat files to clear")
        }
    }

    alertWait("Loading local Backup... (Saving database...)")
    await saveToWorker("database/database.bin", data)
    console.log("[LoadLocalBackup] Saved to OPFS worker")

    await restartApp()
}

/**
 * Restarts the app after backup restoration.
 */
async function restartApp(): Promise<void> {
    alertWait("Loading local Backup... (Restarting...)")

    if (isTauri) {
        const currentPlatform = await platform()
        console.log("[LoadLocalBackup] Platform:", currentPlatform)
        alertClear()
        await sleep(50)

        if (currentPlatform === "android" || currentPlatform === "ios") {
            alertNormal("Backup loaded successfully!\nPlease close and reopen the app.")
        } else {
            await relaunch()
        }
    } else {
        alertClear()
        await sleep(50)
        location.search = ""
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
            if (item.name === "database.risudat") {
                // Save for last - process after all other items
                databaseItem = item
                continue
            }

            if (item.name.startsWith("chats/")) {
                hasChatsFiles = true
                const chatFileName = item.name.slice(6) // Remove 'chats/' prefix
                await saveToWorker(`database/chats/${chatFileName}`, item.data)
                console.log(`[LoadLocalBackup] Restored chat file: ${chatFileName}`)
            } else {
                // Assets go to IndexedDB
                // Backward compatibility: old backups have filename only, new backups have full path
                const assetKey = item.name.startsWith("assets/") ? item.name : "assets/" + item.name
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

        alertNormal("Success")
    } catch (error) {
        console.error("[LoadLocalBackup] Error:", error)
        alertError(`Failed to load backup: ${error?.message || error}`)
    }
}

export async function loadInternalBackup() {
    // Both Tauri and web use OPFS for database storage now
    const files = await listFromWorker("database")
    const internalBackups: string[] = []
    for (const file of files) {
        if (file.includes("dbbackup-")) {
            internalBackups.push(file)
        }
    }

    const selectOptions = [
        "Cancel",
        ...internalBackups.map((a) => {
            return new Date(parseInt(a.replace("dbbackup-", "")) * 100).toLocaleString()
        }),
    ]

    const alertResult = parseInt(await alertSelect(selectOptions)) - 1

    if (alertResult === -1) {
        return
    }

    const selectedBackup = internalBackups[alertResult]

    const data = await loadFromWorker("database/" + selectedBackup)

    setDatabase(await decodeRisuSave(Buffer.from(data) as unknown as Uint8Array))

    await alertNormal("Loaded backup")
}

/**
 * Saves a local backup with all chat data embedded in the database.
 * Unlike SaveLocalBackup, this function loads all chat files and includes them
 * directly in the database, resulting in a single self-contained backup file.
 */
export async function SaveLocalBackupWithEmbeddedChats() {
    alertWait("Saving local backup (with embedded chats)...")
    const writer = new LocalWriter()
    const r = await writer.init()
    if (!r) {
        alertError("Failed")
        return
    }

    const db = getDatabase()

    // Create a deep copy of the database to avoid modifying the original
    const dbCopy: Database = JSON.parse(JSON.stringify(db))

    // Load all chat data from OPFS and embed into the database copy
    let totalChats = 0
    let loadedChats = 0

    // Count total chats first
    for (const char of dbCopy.characters) {
        if (char?.chats) {
            totalChats += char.chats.length
        }
    }

    console.log(`[LocalBackupEmbedded] Total chats to load: ${totalChats}`)

    for (const char of dbCopy.characters) {
        if (!char?.chats) continue

        for (const chat of char.chats) {
            loadedChats++
            alertWait(`Saving local backup (with embedded chats)...\nLoading chats: ${loadedChats}/${totalChats}`)

            // Skip if message is already loaded
            if (chat.message !== undefined) {
                continue
            }

            // Try to load the chat file from OPFS
            try {
                const filePath = `database/chats/${char.chaId}/${chat.id}.bin`
                const data = await loadFromWorker(filePath)

                if (data && data.byteLength > 0) {
                    const fullChat = await decodeChat(data)
                    if (fullChat) {
                        // Embed chat data into the copy
                        chat.message = fullChat.message || []
                        if (fullChat.note !== undefined) chat.note = fullChat.note
                        if (fullChat.localLore !== undefined) chat.localLore = fullChat.localLore
                        if (fullChat.sdData !== undefined) chat.sdData = fullChat.sdData
                        if (fullChat.supaMemoryData !== undefined) chat.supaMemoryData = fullChat.supaMemoryData
                        if (fullChat.hypaV2Data !== undefined) chat.hypaV2Data = fullChat.hypaV2Data
                        if (fullChat.hypaV3Data !== undefined) chat.hypaV3Data = fullChat.hypaV3Data
                        if (fullChat.lastMemory !== undefined) chat.lastMemory = fullChat.lastMemory
                        if (fullChat.suggestMessages !== undefined) chat.suggestMessages = fullChat.suggestMessages
                        if (fullChat.scriptstate !== undefined) chat.scriptstate = fullChat.scriptstate
                    } else {
                        chat.message = []
                    }
                } else {
                    chat.message = []
                }
            } catch (e) {
                console.warn(`[LocalBackupEmbedded] Failed to load chat ${chat.id}:`, e)
                chat.message = []
            }
        }
    }

    console.log(`[LocalBackupEmbedded] Loaded ${loadedChats} chats`)

    // Now save assets (same as SaveLocalBackup)
    const assetMap = new Map<string, { charName: string; assetName: string }>()
    if (db.characters) {
        for (const char of db.characters) {
            if (!char) continue
            const charName = char.name ?? "Unknown Character"

            if (char.image) assetMap.set(char.image, { charName: charName, assetName: "Main Image" })

            if (char.emotionImages) {
                for (const em of char.emotionImages) {
                    if (em && em[1]) assetMap.set(em[1], { charName: charName, assetName: em[0] })
                }
            }
            if (char.type !== "group") {
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
        assetMap.set(db.userIcon, { charName: "User Settings", assetName: "User Icon" })
    }
    if (db.customBackground) {
        assetMap.set(db.customBackground, { charName: "User Settings", assetName: "Custom Background" })
    }
    const missingAssets: string[] = []
    const writtenAssets = new Set<string>()

    // 1. IndexedDB (forageStorage)에서 에셋 수집
    console.log(`[LocalBackupEmbedded] forageStorage.isAccount: ${forageStorage.isAccount}`)
    const keys = await forageStorage.keys()
    console.log(`[LocalBackupEmbedded] All keys count: ${keys.length}, first 10:`, keys.slice(0, 10))
    const indexedDbAssetKeys = keys.filter((key) => key && key.startsWith("assets/"))
    console.log(`[LocalBackupEmbedded] Found ${indexedDbAssetKeys.length} assets in IndexedDB`)
    console.log(
        `[LocalBackupEmbedded] AssetMap has ${assetMap.size} referenced assets. First 5:`,
        [...assetMap.keys()].slice(0, 5)
    )

    // 2. Tauri fs (AppData/assets)에서 에셋 수집 (레거시 데이터 호환)
    let tauriFsAssetKeys: string[] = []
    if (isTauri) {
        try {
            const assetsExist = await exists("assets", { baseDir: BaseDirectory.AppData })
            if (assetsExist) {
                const tauriFsAssets = await readDir("assets", { baseDir: BaseDirectory.AppData })
                tauriFsAssetKeys = tauriFsAssets.filter((a) => a.name && !a.isDirectory).map((a) => "assets/" + a.name)
                console.log(`[LocalBackupEmbedded] Found ${tauriFsAssetKeys.length} assets in Tauri fs`)
            }
        } catch (e) {
            console.warn("[LocalBackupEmbedded] Failed to read Tauri fs assets:", e)
        }
    }

    // DB에서 참조하는 에셋을 기준으로 백업 (assetMap 사용)
    const allAssetKeys = [...assetMap.keys()]
    console.log(`[LocalBackupEmbedded] Total referenced assets to backup: ${allAssetKeys.length}`)

    for (let i = 0; i < allAssetKeys.length; i++) {
        const key = allAssetKeys[i]
        let message = `Saving local Backup (with embedded chats)... (${i + 1} / ${allAssetKeys.length})`
        if (missingAssets.length > 0) {
            const skippedItems = missingAssets
                .map((k) => {
                    const assetInfo = assetMap.get(k)
                    return assetInfo ? `'${assetInfo.assetName}' from ${assetInfo.charName}` : `'${k}'`
                })
                .join(", ")
            message += `\n(Skipping... ${skippedItems})`
        }
        alertWait(message)

        // 먼저 IndexedDB에서 시도
        let data = (await forageStorage.getItem(key)) as unknown as Uint8Array

        // IndexedDB에 없으면 Tauri fs에서 시도
        if (!data && isTauri && tauriFsAssetKeys.includes(key)) {
            try {
                data = await readFile(key, { baseDir: BaseDirectory.AppData })
            } catch (e) {
                // 무시
            }
        }

        // 여전히 없으면 서비스 워커 캐시에서 직접 시도 (웹 환경)
        if (!data && !isTauri && typeof caches !== "undefined") {
            try {
                const encoded = Buffer.from(key, "utf-8").toString("hex")
                const cache = await caches.open("risuCache")
                const cacheUrl = new URL("/sw/img/" + encoded, location.origin)
                const cachedResponse = await cache.match(cacheUrl)
                if (cachedResponse) {
                    const arrayBuffer = await cachedResponse.arrayBuffer()
                    data = new Uint8Array(arrayBuffer)
                    console.log(`[LocalBackupEmbedded] Loaded from Cache API: ${key} (${data.byteLength} bytes)`)
                } else {
                    console.log(`[LocalBackupEmbedded] Not in cache: ${key}`)
                }
            } catch (e) {
                console.log(`[LocalBackupEmbedded] Cache API error for ${key}:`, e)
            }
        }

        if (data && data.byteLength > 0) {
            // Remove "assets/" prefix for backward compatibility with older versions
            const backupName = key.startsWith("assets/") ? key.slice(7) : key
            await writer.writeBackup(backupName, data)
            writtenAssets.add(key)
        } else {
            missingAssets.push(key)
        }
        if (forageStorage.isAccount) {
            await sleep(1000)
        }
    }

    // Encode the database with embedded chats (no separate chat files)
    const dbData = encodeRisuSaveLegacy(dbCopy, "compression")

    alertWait(`Saving local Backup (with embedded chats)... (Saving database)`)

    await writer.writeBackup("database.risudat", dbData)
    await writer.close()

    if (missingAssets.length > 0) {
        let message = "Backup Successful, but the following assets were missing and skipped:\n\n"
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
        alertNormal("Success")
    }
}

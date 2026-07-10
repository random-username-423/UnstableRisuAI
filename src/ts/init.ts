/**
 * App initialization module
 * Contains loadData() and related startup functions
 */

import { BaseDirectory, readFile, exists } from "@tauri-apps/plugin-fs"
import { v4 as uuidv4 } from "uuid"

import { startAutoSaveLoop } from "src/ts/data/storage/autoSaveManager.svelte"
import { forageStorage } from "src/ts/data/storage/autoStorage"

import {
    initOPFSWorker,
    OPFSNotSupportedError,
    OPFSInitializationError,
    loadFromWorker,
    saveToWorker,
    listFromWorker,
    listRecursiveFromWorker,
    deleteFromWorker,
} from "src/ts/data/storage/opfsWorkerClient.svelte"
import { getUnpargeables } from "src/ts/utils/dbUtils"
import { checkCharOrder } from "src/ts/character/characters.svelte"
import { updateHeightMode } from "src/ts/gui/guisize.svelte"
import { isTauri, isNodeServer, isStandaloneMode } from "src/ts/utils/env"
import { setDatabase, getDatabase, defaultSdDataFunc } from "./data/storage/database.svelte"
import type { character, groupChat } from "./data/storage/types"
import { MobileState, SettingsState, ChatState, DBState, AppState } from "./stores.svelte"
import { checkNullish, changeFullscreen, sleep, getBasename } from "./utils/util"
import {
    decodeRisuSave,
    encodeRisuSaveLegacy,
    decodeCharacters,
    decodeBotPresets,
    encodeCharacters,
    encodeBotPresets,
} from "./data/storage/risuSave"
import { presetTemplate } from "./data/storage/database.svelte"
import {
    migrateOPFSAssetsToIndexedDB,
    migrateTauriFsAssetsToIndexedDB,
    migrateTauriDbToOPFS,
    migrateWebDBtoOPFS,
} from "./data/storage/migration"
import { checkRisuUpdate } from "./utils/update"
import { loadPlugins } from "./plugins/plugins.svelte"
import { alertError, alertMd, alertTOS, waitAlert } from "./utils/alert.svelte"
import { checkDriverInit } from "./data/drive/drive"
import { characterURLImport } from "./character/characterCards.svelte"
import { loadRisuAccountData } from "./data/drive/accounter"
import { autoServerBackup } from "./data/kei/backup"
import { updateAnimationSpeed } from "./gui/animation"
import { updateColorScheme, updateTextThemeAndCSS } from "./gui/colorscheme.svelte"
import { updateGuisize } from "./gui/guisize.svelte"
import { startObserveDom } from "./utils/observer.svelte"
import { initMobileGesture } from "./hotkey/hotkey"
import { moduleUpdate } from "src/ts/process/scripting/modules"
import { makeColdData } from "src/ts/process/utils/coldstorage.svelte"
import { language } from "src/lang"
import type { AccountStorage } from "./data/storage/accountStorage.svelte"
import { updateLorebooks } from "./character/characters.svelte"
import { defaultJailbreak, defaultMainPrompt, oldJailbreak, oldMainPrompt } from "./data/storage/defaultPrompts"
import { syncManager } from "./data/drive/syncManager"

/**
 * Loads the application data.
 * Called once at app startup from main.ts.
 */
export async function loadData() {
    if (AppState.loaded) return

    try {
        // 1단계: 스토리지 초기화
        await initOPFSWorker()

        // 2단계: 마이그레이션
        AppState.loadingText = "Checking migration..."
        if (isTauri) {
            await migrateOPFSAssetsToIndexedDB()
            await migrateTauriFsAssetsToIndexedDB()
            await migrateTauriDbToOPFS()
        } else {
            await migrateWebDBtoOPFS()
        }

        // 3단계: DB 로드
        AppState.loadingText = "Reading Save File..."
        let rawData = await loadFromWorker("database/database.bin")
        if (rawData) {
            console.log(`[loadData] database.bin size: ${(rawData.byteLength / 1024 / 1024).toFixed(2)} MB`)
        }

        // 없으면 새로 생성
        if (!rawData || checkNullish(rawData)) {
            console.log("[loadData] No existing data, creating new database")
            rawData = encodeRisuSaveLegacy({})
            if (!isTauri) {
                // saveToWorker transfers the buffer, so we need to copy it first
                // to avoid "detached ArrayBuffer" error when decoding later
                const copyForSave = new Uint8Array(rawData)
                await saveToWorker("database/database.bin", copyForSave as Uint8Array<ArrayBuffer>)
            }
        }

        // 4단계: 디코딩
        try {
            AppState.loadingText = "Decoding Save File..."
            await decodeAndSetupDatabase(rawData, true) // enableDebugLog
            AppState.loadingText = "Loading Chat Files..."
            await migrateChatsToFiles()
        } catch (error) {
            console.error(error)
            await tryRestoreFromBackups({
                useTauriFsFallback: isTauri,
                runChatMigration: true,
                errorMessage: "Forage: Your save file is corrupted",
            })
        }

        if (isTauri) {
            // 5단계: Tauri 전용 - 업데이트 체크
            AppState.loadingText = "Checking Update..."
            await checkRisuUpdate()
            await changeFullscreen()
        }

        if (!isTauri) {
            // 5단계: Web 전용 - 계정 동기화 & 기타
            // const isAccountSync = await forageStorage.checkAccountSync()
            // if (isAccountSync) {
            //     await loadFromAccountSync()
            // }

            AppState.loadingText = "Checking Drive Sync..."
            const isDriverMode = await checkDriverInit()
            if (isDriverMode) {
                return
            }
            AppState.loadingText = "Checking Service Worker..."
            if (navigator.serviceWorker) {
                await registerSw()
            }
            if (getDatabase().didFirstSetup) {
                characterURLImport()
            }
        }

        // 6단계: 공통 로직
        await finalizeLoading()
    } catch (error) {
        if (error instanceof OPFSNotSupportedError) {
            // OPFS 미지원 시 로딩 화면에 에러 표시하고 앱 중단
            AppState.loadingText =
                "Your browser does not support OPFS (Origin Private File System).\nPlease use a modern browser like Chrome, Edge, or Firefox."
            console.error("[loadData] OPFS not supported:", error)
            return
        }
        if (error instanceof OPFSInitializationError) {
            // OPFS 초기화 실패 시 로딩 화면에 에러 표시하고 앱 중단
            AppState.loadingText =
                "Failed to initialize storage.\nPlease try refreshing the page or clearing browser cache."
            console.error("[loadData] OPFS initialization failed:", error)
            return
        }
        alertError(error)
    }
}

/**
 * Gets database backup timestamps from OPFS.
 * Deletes backups exceeding maxBackups limit (default 20).
 */
export async function getDbBackups() {
    const db = getDatabase()
    if (db?.account?.useSync && !isTauri && !isNodeServer) {
        return []
    }
    // Both Tauri and web use OPFS for database storage now
    const files = await listFromWorker("database")

    const backups = files
        .filter((file) => file.startsWith("dbbackup-"))
        .map((file) => parseInt(file.slice(9, -4)))
        .sort((a, b) => b - a)

    const maxBackups = db.maxDbBackups ?? 20
    while (backups.length > maxBackups) {
        const last = backups.pop()
        await deleteFromWorker(`database/dbbackup-${last}.bin`)
    }
    return backups
}

/**
 * Loads characters from characters.bin file.
 * Returns null if file doesn't exist (needs migration).
 */
async function loadCharactersFromFile(): Promise<any[] | null> {
    try {
        const data = await loadFromWorker("database/characters.bin")
        if (!data) return null
        const characters = await decodeCharacters(data)
        console.log(`[loadCharactersFromFile] Loaded ${characters?.length ?? 0} characters from characters.bin`)
        return characters
    } catch (e) {
        console.log("[loadCharactersFromFile] Failed to load characters.bin:", e)
        return null
    }
}

/**
 * Loads bot presets from botpresets.bin file.
 * Returns null if file doesn't exist (needs migration).
 */
async function loadBotPresetsFromFile(): Promise<any[] | null> {
    try {
        const data = await loadFromWorker("database/botpresets.bin")
        if (!data) return null
        const presets = await decodeBotPresets(data)
        console.log(`[loadBotPresetsFromFile] Loaded ${presets?.length ?? 0} presets from botpresets.bin`)
        return presets
    } catch (e) {
        console.log("[loadBotPresetsFromFile] Failed to load botpresets.bin:", e)
        return null
    }
}

/**
 * Migrates characters and botPresets from database.bin to separate files.
 * Called when characters.bin or botpresets.bin don't exist.
 */
async function migrateCharactersAndPresetsToFiles(): Promise<void> {
    const db = getDatabase()

    // Check if characters.bin exists
    const charactersData = await loadFromWorker("database/characters.bin")
    if (!charactersData && db.characters && db.characters.length > 0) {
        console.log(
            `[migrateCharactersAndPresetsToFiles] Migrating ${db.characters.length} characters to characters.bin...`
        )
        AppState.loadingText = `Migrating Characters...`
        // Save only chat metadata (message content is in individual files)
        const charactersToSave = db.characters.map((char) => {
            const chatsMetadata =
                char.chats?.map((chat) => ({
                    id: chat.id,
                    name: chat.name,
                    folderId: chat.folderId,
                    bindedPersona: chat.bindedPersona,
                    modules: chat.modules,
                    lastDate: chat.lastDate,
                    fmIndex: chat.fmIndex,
                })) || []
            return { ...char, chats: chatsMetadata }
        })
        const encoded = await encodeCharacters(charactersToSave as (character | groupChat)[])
        await saveToWorker("database/characters.bin", encoded)
        console.log("[migrateCharactersAndPresetsToFiles] Characters migration complete")
    }

    // Check if botpresets.bin exists
    const presetsData = await loadFromWorker("database/botpresets.bin")
    if (!presetsData && db.botPresets && db.botPresets.length > 0) {
        console.log(
            `[migrateCharactersAndPresetsToFiles] Migrating ${db.botPresets.length} presets to botpresets.bin...`
        )
        AppState.loadingText = `Migrating Bot Presets...`
        const encoded = await encodeBotPresets(db.botPresets)
        await saveToWorker("database/botpresets.bin", encoded)
        console.log("[migrateCharactersAndPresetsToFiles] Bot presets migration complete")
    }
}

/**
 * Tries to restore database from backups.
 * Returns true if successfully restored, false otherwise.
 */
async function tryRestoreFromBackups(
    options: {
        useTauriFsFallback?: boolean
        runChatMigration?: boolean
        errorMessage?: string
    } = {}
): Promise<boolean> {
    const {
        useTauriFsFallback = false,
        runChatMigration = false,
        errorMessage = "Your save file is corrupted",
    } = options

    AppState.loadingText = "Reading Backup Files..."
    const backups = await getDbBackups()

    for (const backup of backups) {
        try {
            AppState.loadingText = `Reading Backup File ${backup}...`
            let backupData = await loadFromWorker(`database/dbbackup-${backup}.bin`)

            // Tauri: try filesystem fallback
            if (!backupData && useTauriFsFallback) {
                if (await exists(`database/dbbackup-${backup}.bin`, { baseDir: BaseDirectory.AppData })) {
                    backupData = await readFile(`database/dbbackup-${backup}.bin`, { baseDir: BaseDirectory.AppData })
                }
            }

            if (backupData) {
                setDatabase(await decodeRisuSave(backupData))
                if (runChatMigration) {
                    AppState.loadingText = "Loading Chat Files..."
                    await migrateChatsToFiles()
                }
                return true
            }
        } catch (error) {
            console.error(error)
        }
    }

    throw errorMessage
}

/**
 * Decodes raw database data and loads characters/presets from separate files.
 * Common logic used by both Tauri and Web environments.
 */
async function decodeAndSetupDatabase(rawData: Uint8Array, enableDebugLog = false): Promise<void> {
    AppState.loadingText = "Decoding Save File..."
    const decoded = await decodeRisuSave(rawData)

    // Debug logging (Web only)
    if (enableDebugLog) {
        console.log(decoded)
        const sizeOf = (obj: any) => {
            try {
                return new Blob([JSON.stringify(obj)]).size
            } catch {
                return 0
            }
        }
        const allFields = Object.keys(decoded)
            .map((key) => ({
                key,
                size: sizeOf((decoded as any)[key]),
            }))
            .sort((a, b) => b.size - a.size)

        console.log(`[loadData] DB breakdown (top 20 fields):`)
        allFields.slice(0, 20).forEach((f) => {
            console.log(`  - ${f.key}: ${(f.size / 1024 / 1024).toFixed(2)} MB`)
        })

        if (decoded.botPresets?.length > 0) {
            const presetSizes = decoded.botPresets
                .map((p: any) => ({
                    name: p.name || "(unnamed)",
                    size: sizeOf(p),
                }))
                .sort((a: any, b: any) => b.size - a.size)
                .slice(0, 10)
            console.log(`  - Top 10 botPresets by size (total ${decoded.botPresets.length}):`)
            presetSizes.forEach((p: any, i: number) => {
                console.log(`    ${i + 1}. ${p.name}: ${(p.size / 1024 / 1024).toFixed(2)} MB`)
            })
        }

        if (decoded.characters?.length > 0) {
            const charSizes = decoded.characters
                .map((c: any) => ({
                    name: c.name,
                    size: sizeOf(c),
                    chatsSize: sizeOf(c.chats),
                    chatsCount: c.chats?.length ?? 0,
                }))
                .sort((a: any, b: any) => b.size - a.size)
                .slice(0, 10)
            console.log(`  - Top 10 characters by size:`)
            charSizes.forEach((c: any, i: number) => {
                console.log(
                    `    ${i + 1}. ${c.name}: ${(c.size / 1024 / 1024).toFixed(2)} MB (chats: ${(c.chatsSize / 1024 / 1024).toFixed(2)} MB, ${c.chatsCount} chats)`
                )
            })
        }
    }

    // Load characters from separate file if exists
    AppState.loadingText = "Loading Characters..."
    const characters = await loadCharactersFromFile()
    if (characters) {
        decoded.characters = characters
    }

    // Load bot presets from separate file if exists
    AppState.loadingText = "Loading Bot Presets..."
    const presets = await loadBotPresetsFromFile()
    if (presets) {
        decoded.botPresets = presets
    }
    // Ensure botPresets has valid default
    if (!Array.isArray(decoded.botPresets) || decoded.botPresets.length === 0) {
        decoded.botPresets = [presetTemplate]
        decoded.botPresetsId = 0
    }

    setDatabase(decoded)

    // Migrate characters and presets to separate files if needed
    AppState.loadingText = "Checking Data Migration..."
    await migrateCharactersAndPresetsToFiles()
}

/**
 * Migrates chats from old format (full chats in DB) to new format (individual files).
 * In new format, DB only contains chat metadata, full data is loaded on demand.
 */
async function migrateChatsToFiles(): Promise<void> {
    const db = getDatabase()
    if (!db?.characters) return

    // Get existing chat files to skip already migrated chats
    let existingFiles = new Set<string>()
    try {
        const files = await listRecursiveFromWorker("database/chats")
        existingFiles = new Set(files)
        console.log(`[migrateChatsToFiles] Found ${existingFiles.size} existing chat files`)
    } catch {
        // No existing files
    }

    // Count total chats that need migration (excluding already migrated)
    let totalChats = 0
    for (const char of db.characters) {
        if (!char.chats || !char.chaId) continue
        for (const chat of char.chats) {
            if (chat.message !== undefined && chat.message.length > 0) {
                // Skip if file already exists
                const filePath = `${char.chaId}/${chat.id}.bin`
                if (existingFiles.has(filePath)) continue
                totalChats++
            }
        }
    }

    if (totalChats === 0) {
        console.log("[migrateChatsToFiles] No migration needed")
        return
    }

    console.log(`[migrateChatsToFiles] Migrating ${totalChats} chats to individual files...`)
    const { encodeChat } = await import("./data/storage/risuSave")

    let migratedCount = 0
    for (const char of db.characters) {
        if (!char.chats || !char.chaId) continue
        for (const chat of char.chats) {
            // Only migrate chats that have message data
            if (chat.message === undefined || chat.message.length === 0) continue

            if (!chat.id) {
                chat.id = uuidv4() // Ensure chat has id
            }

            // Skip if file already exists
            const filePath = `${char.chaId}/${chat.id}.bin`
            if (existingFiles.has(filePath)) {
                console.log(`[migrateChatsToFiles] Skipping ${filePath} - already exists`)
                continue
            }

            try {
                const encodedChat = await encodeChat(chat)
                await saveToWorker(`database/chats/${char.chaId}/${chat.id}.bin`, encodedChat)
                migratedCount++
                AppState.loadingText = `Migrating Chat Files... (${migratedCount}/${totalChats})`
            } catch (e) {
                console.error(`[migrateChatsToFiles] Failed to migrate chat ${chat.id}:`, e)
                migratedCount++
                AppState.loadingText = `Migrating Chat Files... (${migratedCount}/${totalChats})`
            }
        }
    }
    console.log("[migrateChatsToFiles] Migration complete")

    // 디버그: 저장된 파일 목록 확인
    try {
        const savedFiles = await listRecursiveFromWorker("database/chats")
        console.log("[migrateChatsToFiles] Files in OPFS after migration:", savedFiles)
    } catch (e) {
        console.log("[migrateChatsToFiles] Failed to list files:", e)
    }
}

/**
 * Common finalization after database is loaded.
 * Called by both Tauri and Web environments.
 */
async function finalizeLoading(): Promise<void> {
    AppState.loadingText = "Checking Unnecessary Files..."
    try {
        await pargeChunks()
    } catch (error) {
        console.error(error)
    }
    AppState.loadingText = "Loading Plugins..."
    try {
        await loadPlugins()
    } catch (error) {}
    if (getDatabase().account) {
        AppState.loadingText = "Checking Account Data..."
        try {
            await loadRisuAccountData()
        } catch (error) {}
    }
    try {
        if (isStandaloneMode()) {
            await navigator.storage.persist()
        }
    } catch (error) {}
    AppState.loadingText = "Normalizing Database..."
    await normalizeDatabase()
    const db = getDatabase()

    AppState.loadingText = "Updating States..."
    updateColorScheme()
    updateTextThemeAndCSS()
    updateAnimationSpeed()
    updateHeightMode()
    updateErrorHandling()
    updateGuisize()
    if (!localStorage.getItem("nightlyWarned") && window.location.hostname === "nightly.risuai.xyz") {
        alertMd(language.nightlyWarning)
        await waitAlert()
        //for testing, leave empty
        localStorage.setItem("nightlyWarned", "")
    }
    if (db.botSettingAtStart) {
        SettingsState.botMakerMode = true
    }
    if (db.betaMobileGUI && window.innerWidth <= 800) {
        initMobileGesture()
        MobileState.enabled = true
    }

    // Google Drive 실시간 동기화 - UI 표시 전에 최신 데이터 가져오기
    if (db.syncEnabled && syncManager.hasAccessToken()) {
        AppState.loadingText = "Syncing with Google Drive..."
        try {
            await syncManager.doInitialSync()
        } catch (error) {
            console.error("[finalizeLoading] Initial sync failed:", error)
            // 동기화 실패해도 앱은 계속 로드
        }
    }

    // Debug: Log first 10 character image paths
    const debugDb = getDatabase()
    if (debugDb.characters && debugDb.characters.length > 0) {
        console.log("[DEBUG] First 10 character image paths:")
        for (let i = 0; i < Math.min(10, debugDb.characters.length); i++) {
            const char = debugDb.characters[i]
            console.log(`  ${i + 1}. "${char.name}": image="${char.image}"`)
            if (char.emotionImages && char.emotionImages.length > 0) {
                console.log(`     emotionImages[0]: "${char.emotionImages[0]?.[1]}"`)
            }
        }
    }

    AppState.loaded = true
    ChatState.selectedCharId = -1
    startObserveDom()
    ensureValidIds()
    makeColdData()
    startAutoSaveLoop()
    moduleUpdate()
    if (import.meta.env.VITE_RISU_TOS === "TRUE") {
        alertTOS().then((a) => {
            if (a === false) {
                location.reload()
            }
        })
    }
}

/**
 * Loads database from account sync (remote storage).
 * Called when user has account sync enabled.
 */
async function loadFromAccountSync(): Promise<void> {
    AppState.loadingText = "Checking Account Sync..."
    let gotStorage: Uint8Array = await (forageStorage.realStorage as AccountStorage).getItem(
        "database/database.bin",
        (v) => {
            AppState.loadingText = `Loading Remote Save File ${(v * 100).toFixed(2)}%`
        }
    )
    if (checkNullish(gotStorage)) {
        gotStorage = encodeRisuSaveLegacy({})
        await forageStorage.setItem("database/database.bin", gotStorage as Uint8Array<ArrayBuffer>)
    }
    try {
        setDatabase(await decodeRisuSave(gotStorage))
    } catch (error) {
        // Try to restore from backups
        const backups = await getDbBackups()
        let backupLoaded = false
        for (const backup of backups) {
            try {
                AppState.loadingText = `Reading Backup File ${backup}...`
                const backupData: Uint8Array = (await forageStorage.getItem(
                    `database/dbbackup-${backup}.bin`
                )) as unknown as Uint8Array
                setDatabase(await decodeRisuSave(backupData))
                backupLoaded = true
                break
            } catch (error) {}
        }
        if (!backupLoaded) {
            await autoServerBackup()
            await sleep(10000)
        }
    }
}

/**
 * Registers the service worker for PWA functionality.
 */
async function registerSw() {
    await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
    })
    await sleep(100)
    const da = await fetch("/sw/init")
    if (!(da.status >= 200 && da.status < 300)) {
        location.reload()
    }
}

/**
 * Assigns unique IDs to characters and chats.
 */
function ensureValidIds() {
    if (!DBState?.db?.characters) {
        return
    }
    const assignedIds = new Set<string>()
    for (let i = 0; i < DBState.db.characters.length; i++) {
        const cha = DBState.db.characters[i]
        if (!cha.chaId) {
            cha.chaId = uuidv4()
        }
        if (assignedIds.has(cha.chaId)) {
            console.warn(`Duplicate chaId found: ${cha.chaId}. Assigning new ID.`)
            cha.chaId = uuidv4()
        }
        assignedIds.add(cha.chaId)
        for (let i2 = 0; i2 < cha.chats.length; i2++) {
            const chat = cha.chats[i2]
            if (!chat.id) {
                chat.id = uuidv4()
            }
            if (assignedIds.has(chat.id)) {
                console.warn(`Duplicate chat ID found: ${chat.id}. Assigning new ID.`)
                chat.id = uuidv4()
            }
            assignedIds.add(chat.id)
        }
    }
}

/**
 * Cleans up unused asset files from storage.
 */
async function pargeChunks() {
    const db = getDatabase()
    if (db.account?.useSync) {
        return
    }

    const unpargeable = new Set(getUnpargeables(db))
    const indexes = await forageStorage.keys()
    for (const asset of indexes) {
        if (!asset.startsWith("assets/")) {
            continue
        }
        const n = getBasename(asset)
        if (!unpargeable.has(n)) {
            await forageStorage.removeItem(asset)
        }
    }
}

/**
 * Sets up global error handlers.
 */
function updateErrorHandling() {
    const errorHandler = (event: ErrorEvent) => {
        console.error(event.error)
        alertError(event.error)
    }
    const rejectHandler = (event: PromiseRejectionEvent) => {
        console.error(event.reason)
        alertError(event.reason)
    }
    window.addEventListener("error", errorHandler)
    window.addEventListener("unhandledrejection", rejectHandler)
}

/**
 * Normalizes database by applying default values, migrating legacy formats, and filtering invalid entries.
 */
async function normalizeDatabase(): Promise<void> {
    const db = getDatabase()

    // Check data integrity
    db.characters = db.characters
        .map((v) => {
            if (!v) {
                return null
            }
            v.chaId ??= uuidv4()
            v.type ??= "character"
            v.chatPage ??= 0
            v.chats ??= []
            v.customscript ??= []
            v.firstMessage ??= ""
            v.globalLore ??= []
            v.name ??= ""
            v.viewScreen ??= "none"
            v.emotionImages = v.emotionImages ?? []

            if (v.type === "character") {
                v.bias ??= []
                v.characterVersion ??= ""
                v.creator ??= ""
                v.desc ??= ""
                v.utilityBot ??= false
                v.tags ??= []
                v.systemPrompt ??= ""
                v.scenario ??= ""
            }

            // Migrate modifiedAt for sync (set to now if not exists)
            v.modifiedAt ??= Date.now()

            // Migrate chat modifiedAt
            for (const chat of v.chats ?? []) {
                chat.modifiedAt ??= chat.lastDate ?? Date.now()
            }

            return v
        })
        .filter((v) => {
            return v !== null
        })

    db.modules = (db.modules ?? [])
        .map((v) => {
            if (v?.lorebook) {
                v.lorebook = updateLorebooks(v.lorebook)
            }
            return v
        })
        .filter((v) => {
            return v !== null && v !== undefined
        })

    db.personas = (db.personas ?? [])
        .map((v) => {
            v.id ??= uuidv4()
            return v
        })
        .filter((v) => {
            return v !== null && v !== undefined
        })

    if (!db.formatversion) {
        function checkParge(data: string) {
            if (data.startsWith("assets") || data.length < 3) {
                return data
            } else {
                const d = "assets/" + data.replace(/\\/g, "/").split("assets/")[1]
                if (!d) {
                    return data
                }
                return d
            }
        }

        db.customBackground = checkParge(db.customBackground)
        db.userIcon = checkParge(db.userIcon)

        for (let i = 0; i < db.characters.length; i++) {
            if (db.characters[i].image) {
                db.characters[i].image = checkParge(db.characters[i].image)
            }
            if (db.characters[i].emotionImages) {
                for (let i2 = 0; i2 < db.characters[i].emotionImages.length; i2++) {
                    if (db.characters[i].emotionImages[i2] && db.characters[i].emotionImages[i2].length >= 2) {
                        db.characters[i].emotionImages[i2][1] = checkParge(db.characters[i].emotionImages[i2][1])
                    }
                }
            }
        }

        db.formatversion = 2
    }
    if (db.formatversion < 3) {
        for (let i = 0; i < db.characters.length; i++) {
            const cha = db.characters[i]
            if (cha.type === "character") {
                if (checkNullish(cha.sdData)) {
                    cha.sdData = defaultSdDataFunc()
                }
            }
        }

        db.formatversion = 3
    }
    if (db.formatversion < 4) {
        //migration removed due to issues
        db.formatversion = 4
    }
    if (db.formatversion < 5) {
        if (db.loreBookToken < 8000) {
            db.loreBookToken = 8000
        }
        db.formatversion = 5
    }
    if (!db.characterOrder) {
        db.characterOrder = []
    }
    if (db.mainPrompt === oldMainPrompt) {
        db.mainPrompt = defaultMainPrompt
    }
    if (db.mainPrompt === oldJailbreak) {
        db.mainPrompt = defaultJailbreak
    }
    for (let i = 0; i < db.characters.length; i++) {
        const trashTime = db.characters[i].trashTime
        const targetTrashTime = trashTime ? trashTime + 1000 * 60 * 60 * 24 * 3 : 0
        if (trashTime && targetTrashTime < Date.now()) {
            db.characters.splice(i, 1)
            i--
        }
    }
    setDatabase(db)
    checkCharOrder()
}

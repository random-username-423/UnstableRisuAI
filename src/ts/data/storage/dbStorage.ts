import { type Database, type character, type groupChat } from "./database.svelte"
import { RisuSaveEncoder, type toSaveType, encodeCharacters, encodeBotPresets } from "./risuSave"
import { saveToWorker, isWorkerReady } from "./opfsWorkerClient.svelte"
import { forageStorage } from "./autoStorage"
import { syncManager } from "../drive/syncManager"
import { saveChat } from "./chatStorage"

export interface SaveMainDataOptions {
    db: Database
    dbData: Uint8Array<ArrayBuffer>
    toSave: toSaveType
    shouldExcludeChats: boolean
    shouldSeparateCharactersAndPresets: boolean
    shouldBackup: boolean
    now: number
}

export interface SaveMainDataResult {
    backedUp: boolean
}

/**
 * Saves the main database files (database.bin, characters.bin, botpresets.bin, backup).
 * This function handles the low-level file saving logic.
 *
 * @param options - Save options
 * @returns Result containing whether backup was created
 */
export async function saveMainData(options: SaveMainDataOptions): Promise<SaveMainDataResult> {
    const { db, dbData, toSave, shouldExcludeChats, shouldSeparateCharactersAndPresets, shouldBackup, now } = options
    let backedUp = false

    if (!forageStorage.isAccount && isWorkerReady()) {
        // Save database.bin
        await saveToWorker('database/database.bin', dbData)

        // Create backup if needed
        if (shouldBackup) {
            const backupEncoder = new RisuSaveEncoder()
            await backupEncoder.init(db, {
                compression: false,
                excludeChats: false // 백업에는 모든 채팅 포함
            })
            const backupEncoded = backupEncoder.encode()
            if (backupEncoded) {
                const backupData = new Uint8Array(backupEncoded)
                const backupName = `database/dbbackup-${(now / 100).toFixed()}.bin`
                await saveToWorker(backupName, backupData)
                console.log(`[dbStorage] Internal backup created: ${backupName} (${(backupData.byteLength / 1024 / 1024).toFixed(2)} MB)`)
            }
            backedUp = true
        }

        // Save changed chats
        if (shouldExcludeChats && toSave.chat.length > 0) {
            for (const [chaId, chatId] of toSave.chat) {
                if (!chatId || !chaId) continue
                const char = db.characters.find(c => c.chaId === chaId)
                const chat = char?.chats.find(c => c.id === chatId)
                if (chat) {
                    await saveChat(chaId, chat)
                }
            }
        }

        // Save characters.bin
        if (shouldSeparateCharactersAndPresets && toSave.character.length > 0) {
            const charactersToSave = db.characters.map(char => {
                const chatsMetadata = char.chats?.map(chat => ({
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
            const encodedCharacters = await encodeCharacters(charactersToSave as (character | groupChat)[])
            await saveToWorker('database/characters.bin', encodedCharacters)

            // Mark characters for sync (debounced)
            for (const chaId of toSave.character) {
                if (chaId) {
                    syncManager.markCharacterChanged(chaId)
                }
            }
        }

        // Save botpresets.bin
        if (shouldSeparateCharactersAndPresets && toSave.botPreset) {
            const encodedPresets = await encodeBotPresets(db.botPresets)
            await saveToWorker('database/botpresets.bin', encodedPresets)

            // Mark bot presets for sync (debounced)
            syncManager.markBotPresetsChanged()
        }
    } else {
        // Fallback to forageStorage (Account mode or Worker not ready)
        await forageStorage.setItem('database/database.bin', dbData)

        if (!forageStorage.isAccount && shouldBackup) {
            const backupEncoder = new RisuSaveEncoder()
            await backupEncoder.init(db, {
                compression: false,
                excludeChats: false // 백업에는 모든 채팅 포함
            })
            const backupEncoded = backupEncoder.encode()
            if (backupEncoded) {
                const backupData = new Uint8Array(backupEncoded)
                const backupName = `database/dbbackup-${(now / 100).toFixed()}.bin`
                await forageStorage.setItem(backupName, backupData)
                console.log(`[dbStorage] Internal backup created (forageStorage): ${backupName} (${(backupData.byteLength / 1024 / 1024).toFixed(2)} MB)`)
            }
            backedUp = true
        }
    }

    return { backedUp }
}

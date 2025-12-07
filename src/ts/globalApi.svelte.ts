import { sleep, getBasename } from "./utils/util"
import { getDbBackups } from "./init"
import { v4 } from 'uuid';
import { setDatabase, type Database, getDatabase, type Chat, type character, type groupChat } from "./data/storage/database.svelte";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { selectedCharID, DBState } from "./stores.svelte";
import { alertConfirm, alertNormal, alertNormalWait } from "./utils/alert";
import { syncDrive } from "./data/drive/drive";
import { syncManager } from "./data/drive/syncManager";
import { decodeRisuSave, RisuSaveEncoder, type toSaveType, encodeChat, decodeChat, encodeCharacters, encodeBotPresets } from "./data/storage/risuSave";
import { forageStorage } from "./data/storage/autoStorage";
import { saveDbKei } from "./data/kei/backup";
import { language } from "src/lang";
import { isTauri } from "src/ts/utils/env";
import {
    initOPFSWorker,
    OPFSNotSupportedError,
    OPFSInitializationError,
    saveToWorker,
    loadFromWorker,
    listFromWorker,
    listWithSizesFromWorker,
    deleteFromWorker,
    isWorkerReady
} from './data/storage/opfsWorkerClient.svelte'


const appWindow = isTauri ? getCurrentWebviewWindow() : null

let lastSave = ''
let lastBackupTime = 0
export let saving = $state({
    state: false,
    paused: false  // 백업 복원 중 저장 일시정지
})

/**
 * Loads a chat's full data from individual file (lazy loading).
 * Updates the chat in the character's chats array with message data.
 *
 * @param chaId - Character ID
 * @param chatId - Chat ID
 * @returns The loaded chat, or null if not found
 */
export async function loadChat(chaId: string, chatId: string): Promise<Chat | null> {
    const db = getDatabase()
    const char = db.characters.find(c => c.chaId === chaId)
    if (!char) {
        console.warn(`[loadChat] Character not found: ${chaId}`)
        return null
    }

    const chatIndex = char.chats.findIndex(c => c.id === chatId)
    if (chatIndex === -1) {
        console.warn(`[loadChat] Chat not found: ${chatId}`)
        return null
    }

    const chat = char.chats[chatIndex]

    // Already loaded
    if (chat.message !== undefined) {
        return chat
    }

    // Load from file
    try {
        const filePath = `database/chats/${chaId}_${chatId}.bin`
        console.log(`[loadChat] Loading file: ${filePath}`)
        const data = await loadFromWorker(filePath)
        console.log(`[loadChat] File load result:`, data ? `${data.byteLength} bytes` : 'null')
        if (!data) {
            console.warn(`[loadChat] Chat file not found: ${chaId}_${chatId}.bin`)
            // Initialize empty message array
            console.log(`[DEBUG chat.message=[]] globalApi.svelte.ts:loadChat - file not found, chaId=${chaId}, chatId=${chatId}`)
            chat.message = []
            return chat
        }

        const fullChat = await decodeChat(data)
        if (!fullChat) {
            console.warn(`[loadChat] Failed to decode chat: ${chatId}`)
            console.log(`[DEBUG chat.message=[]] globalApi.svelte.ts:loadChat - decode failed, chaId=${chaId}, chatId=${chatId}`)
            chat.message = []
            return chat
        }

        // Update chat with loaded data (preserve metadata, load message)
        chat.message = fullChat.message || []
        // Also update other fields that might be stored in the file
        if (fullChat.note !== undefined) chat.note = fullChat.note
        if (fullChat.localLore !== undefined) chat.localLore = fullChat.localLore
        if (fullChat.sdData !== undefined) chat.sdData = fullChat.sdData
        if (fullChat.supaMemoryData !== undefined) chat.supaMemoryData = fullChat.supaMemoryData
        if (fullChat.hypaV2Data !== undefined) chat.hypaV2Data = fullChat.hypaV2Data
        if (fullChat.hypaV3Data !== undefined) chat.hypaV3Data = fullChat.hypaV3Data
        if (fullChat.lastMemory !== undefined) chat.lastMemory = fullChat.lastMemory
        if (fullChat.suggestMessages !== undefined) chat.suggestMessages = fullChat.suggestMessages
        if (fullChat.scriptstate !== undefined) chat.scriptstate = fullChat.scriptstate

        console.log(`[loadChat] Loaded chat ${chatId} for character ${chaId}`)
        return chat
    } catch (e) {
        console.error(`[loadChat] Error loading chat ${chatId}:`, e)
        console.log(`[DEBUG chat.message=[]] globalApi.svelte.ts:loadChat - catch error, chaId=${chaId}, chatId=${chatId}`)
        chat.message = []
        return chat
    }
}

/**
 * Saves a single chat to its individual file.
 *
 * @param chaId - Character ID
 * @param chat - Chat to save
 */
export async function saveChat(chaId: string, chat: Chat): Promise<void> {
    if (!chat.id || !chaId) return

    // Don't save if message is not loaded (nothing to save)
    if (chat.message === undefined) return

    // Update modifiedAt for sync
    chat.modifiedAt = Date.now()

    try {
        const encodedChat = await encodeChat(chat)
        await saveToWorker(`database/chats/${chaId}_${chat.id}.bin`, encodedChat)

        // Mark for sync (debounced)
        syncManager.markChatChanged(chaId, chat.id)
    } catch (e) {
        console.error(`[saveChat] Error saving chat ${chat.id}:`, e)
    }
}

/**
 * Saves the current state of the database.
 *
 * @returns {Promise<void>} - A promise that resolves when the database has been saved.
 */
export let requiresFullEncoderReload = $state({
    state: false
})
export async function saveDb(){
    let changed = false
    syncDrive()
    let gotChannel = false
    const sessionID = v4()
    let channel:BroadcastChannel
    if(window.BroadcastChannel){
        channel = new BroadcastChannel('risu-db')
    }

    // Initialize worker if not already done
    await initOPFSWorker()

    if(channel){
        channel.onmessage = async (ev) => {
            if(ev.data === sessionID){
                return
            }
            if(!gotChannel){
                gotChannel = true
                alertNormalWait(language.activeTabChange).then(() => {
                    location.reload()
                })
            }
        }
    }

    const changeTracker:toSaveType = {
        character: [],
        chat: [],
        botPreset: false,
        modules: false
    }

    let encoder = new RisuSaveEncoder()
    // Account 동기화 모드에서는 chats 분리 안 함 (기존 형식 유지)
    const shouldExcludeChats = !forageStorage.isAccount
    // Account 동기화 모드에서는 characters/presets 분리 안 함
    const shouldSeparateCharactersAndPresets = !forageStorage.isAccount
    await encoder.init(getDatabase(), {
        compression: forageStorage.isAccount,
        excludeChats: shouldExcludeChats,
        separateCharactersAndPresets: shouldSeparateCharactersAndPresets
    })

    $effect.root(() => {

        let selIdState = $state(0)

        const debounceTime = 500; // 500 milliseconds
        let saveTimeout: ReturnType<typeof setTimeout> | null = null;

        selectedCharID.subscribe((v) => {
            selIdState = v
        })

        function saveTimeoutExecute() {
            if (saveTimeout) {
                clearTimeout(saveTimeout);
            }
            saveTimeout = setTimeout(() => {
                changed = true;
            }, debounceTime);
        }

        $effect(() => {
            DBState.db.botPresetsId
            DBState.db.botPresets.length
            changeTracker.botPreset = true
            saveTimeoutExecute()
        })
        $effect(() => {
            $state.snapshot(DBState.db.modules)
            changeTracker.modules = true
            saveTimeoutExecute()
        })
        $effect(() => {
            for(const key in DBState.db){
                if(key !== 'characters' && key !== 'botPresets' && key !== 'modules'){
                    $state.snapshot(DBState.db[key])
                }
            }
            if(DBState?.db?.characters?.[selIdState]){
                for(const key in DBState.db.characters[selIdState]){
                    if(key !== 'chats'){
                        $state.snapshot(DBState.db.characters[selIdState][key])
                    }
                }
                // Track chats length and current chat only (not all chats) for performance
                const chats = DBState.db.characters[selIdState].chats
                chats?.length
                const currentChatPage = DBState.db.characters[selIdState].chatPage
                const currentChat = chats?.[currentChatPage]
                if (currentChat) {
                    $state.snapshot(currentChat)
                }
                if(changeTracker.character[0] !== DBState.db.characters[selIdState]?.chaId){
                    changeTracker.character.unshift(DBState.db.characters[selIdState]?.chaId)
                }
                if(
                    changeTracker.chat[0]?.[0] !== DBState.db.characters[selIdState]?.chaId ||
                    changeTracker.chat[0]?.[1] !== DBState.db.characters[selIdState]?.chats[DBState.db.characters[selIdState]?.chatPage].id
                ){
                    changeTracker.chat.unshift([DBState.db.characters[selIdState]?.chaId, DBState.db.characters[selIdState]?.chats[DBState.db.characters[selIdState]?.chatPage].id])
                }
            }
            saveTimeoutExecute()
        })
    })

    let savetrys = 0
    let lastDbData = new Uint8Array(0)
    await sleep(1000)
    while(true){
        if(!changed || saving.paused){
            await sleep(500)
            continue
        }

        saving.state = true
        changed = false
        try {

            if(requiresFullEncoderReload.state){
                encoder = new RisuSaveEncoder()
                await encoder.init(getDatabase(), {
                    compression: forageStorage.isAccount,
                    excludeChats: shouldExcludeChats,
                    separateCharactersAndPresets: shouldSeparateCharactersAndPresets
                })
                requiresFullEncoderReload.state = false
            }

            let toSave = safeStructuredClone(changeTracker)
            changeTracker.character = changeTracker.character.length === 0 ? [] : [changeTracker.character[0]]
            changeTracker.chat = changeTracker.chat.length === 0 ? [] : [changeTracker.chat[0]]
            changeTracker.botPreset = false
            changeTracker.modules = false
            if(gotChannel){
                //Data is saved in other tab
                await sleep(1000)
                continue
            }
            if(channel){
                channel.postMessage(sessionID)
            }
            let db = getDatabase()
            if(!db.characters){
                await sleep(1000)
                continue
            }

            await encoder.set(db, toSave)
            const encoded = encoder.encode()
            if(!encoded){
                await sleep(1000)
                continue
            }
            const dbData = new Uint8Array(encoded)
            // Tauri와 웹 모두 OPFS Worker 사용
            // Worker를 사용하면 메인 스레드 블로킹 없음
            const now = Date.now()
            const intervalMs = (db.dbBackupIntervalMinutes ?? 10) * 60 * 1000
            const shouldBackup = (now - lastBackupTime) >= intervalMs

            if(!forageStorage.isAccount && isWorkerReady()){
                await saveToWorker('database/database.bin', dbData)
                if(shouldBackup){
                    // 백업은 chats 포함한 전체 DB로 저장 (복구용)
                    const backupEncoder = new RisuSaveEncoder()
                    await backupEncoder.init(db, {
                        compression: false,
                        excludeChats: false // 백업에는 모든 채팅 포함
                    })
                    const backupEncoded = backupEncoder.encode()
                    if(backupEncoded){
                        const backupData = new Uint8Array(backupEncoded)
                        await saveToWorker(`database/dbbackup-${(now/100).toFixed()}.bin`, backupData)
                    }
                    lastBackupTime = now
                }
                // 변경된 채팅만 개별 파일로 저장
                if(shouldExcludeChats && toSave.chat.length > 0){
                    for(const [chaId, chatId] of toSave.chat){
                        if(!chatId || !chaId) continue
                        const char = db.characters.find(c => c.chaId === chaId)
                        const chat = char?.chats.find(c => c.id === chatId)
                        // message가 undefined면 로드되지 않은 채팅이므로 저장하지 않음 (파일 덮어쓰기 방지)
                        if(chat && chat.message !== undefined){
                            const encodedChat = await encodeChat(chat)
                            // 파일명에 chaId 포함하여 로드 시 매칭 가능하도록
                            await saveToWorker(`database/chats/${chaId}_${chatId}.bin`, encodedChat)
                        }
                    }
                }
                // 캐릭터 변경 시 characters.bin 저장
                if(shouldSeparateCharactersAndPresets && toSave.character.length > 0){
                    // 채팅 메타데이터만 포함하여 저장 (채팅 본문은 개별 파일)
                    const charactersToSave = db.characters.map(char => {
                        const chatsMetadata = char.chats?.map(chat => ({
                            id: chat.id,
                            name: chat.name,
                            folderId: chat.folderId,
                            bindedPersona: chat.bindedPersona,
                            modules: chat.modules,
                            lastDate: chat.lastDate,
                            fmIndex: chat.fmIndex,
                        })) || [];
                        return { ...char, chats: chatsMetadata };
                    });
                    const encodedCharacters = await encodeCharacters(charactersToSave as (character | groupChat)[])
                    await saveToWorker('database/characters.bin', encodedCharacters)

                    // Mark characters for sync (debounced)
                    for (const chaId of toSave.character) {
                        if (chaId) {
                            syncManager.markCharacterChanged(chaId)
                        }
                    }
                }
                // 프리셋 변경 시 botpresets.bin 저장
                if(shouldSeparateCharactersAndPresets && toSave.botPreset){
                    const encodedPresets = await encodeBotPresets(db.botPresets)
                    await saveToWorker('database/botpresets.bin', encodedPresets)

                    // Mark bot presets for sync (debounced)
                    syncManager.markBotPresetsChanged()
                }
            }
            else{
                await forageStorage.setItem('database/database.bin', dbData)
                if(!forageStorage.isAccount && shouldBackup){
                    // 백업은 chats 포함한 전체 DB로 저장 (복구용)
                    const backupEncoder = new RisuSaveEncoder()
                    await backupEncoder.init(db, {
                        compression: false,
                        excludeChats: false // 백업에는 모든 채팅 포함
                    })
                    const backupEncoded = backupEncoder.encode()
                    if(backupEncoded){
                        const backupData = new Uint8Array(backupEncoded)
                        await forageStorage.setItem(`database/dbbackup-${(now/100).toFixed()}.bin`, backupData)
                    }
                    lastBackupTime = now
                }
                if(forageStorage.isAccount){
                    await sleep(3000)
                }
            }
            if(!forageStorage.isAccount){
                await getDbBackups()
            }
            savetrys = 0            
            await saveDbKei()
            await sleep(500)
        } catch (error) {
            savetrys += 1
            if(savetrys > 4){
                await alertConfirm(`DBSaveError: ${error.message ?? error}. report to the developer.`)
            }
            else{
                console.error(error)
            }
        }

        saving.state = false
    }
}

// Re-export toggleFullscreen (renamed to toggleDomFullscreen in util.ts)
export { toggleDomFullscreen as toggleFullscreen } from './utils/util'

export function getLanguageCodes(){
    let languageCodes:{
        code: string
        name: string
    }[] = []

    for(let i=0x41;i<=0x5A;i++){
        for(let j=0x41;j<=0x5A;j++){
            languageCodes.push({
                code: String.fromCharCode(i) + String.fromCharCode(j),
                name: ''
            })
        }
    }
    
    languageCodes = languageCodes.map(v => {
        return {
            code: v.code.toLocaleLowerCase(),
            name: new Intl.DisplayNames([
                DBState.db.language === 'cn' ? 'zh' : DBState.db.language
            ], {
                type: 'language',
                fallback: 'none'
            }).of(v.code)
        }
    }).filter((a) => {
        return a.name
    }).sort((a, b) => a.name.localeCompare(b.name))

    return languageCodes
}


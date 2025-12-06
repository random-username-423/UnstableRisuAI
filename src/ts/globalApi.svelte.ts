import {
    writeFile,
    BaseDirectory,
    readFile
} from "@tauri-apps/plugin-fs"
import { sleep, getBasename } from "./utils/util"
import { getDbBackups } from "./init"
import { convertFileSrc } from "@tauri-apps/api/core"
import { v4 as uuidv4, v4 } from 'uuid';
import { appDataDir, join } from "@tauri-apps/api/path";
import {open} from '@tauri-apps/plugin-shell'
import { setDatabase, type Database, getDatabase, appVer, type Chat, type character, type groupChat } from "./data/storage/database.svelte";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { selectedCharID, DBState } from "./stores.svelte";
import { alertConfirm, alertError, alertMd, alertNormal, alertNormalWait, alertSelect, alertTOS, alertWait, waitAlert } from "./utils/alert";
import { syncDrive } from "./data/drive/drive";
import { syncManager } from "./data/drive/syncManager";
import { hasher } from "./utils/parser.svelte";
import { hubURL } from "./character/characterCards";
import { decodeRisuSave, RisuSaveEncoder, type toSaveType, encodeChat, decodeChat, encodeCharacters, encodeBotPresets } from "./data/storage/risuSave";
import { AutoStorage } from "./data/storage/autoStorage";
import { saveDbKei } from "./data/kei/backup";
import { save } from "@tauri-apps/plugin-dialog";
import { language } from "src/lang";
import { AppendableBuffer } from './utils/fetch';
import { isTauri, isNodeServer, isMobileTauri } from "src/ts/utils/env";
import {
    initOPFSWorker,
    saveToWorker,
    loadFromWorker,
    listFromWorker,
    listWithSizesFromWorker,
    deleteFromWorker,
    isWorkerReady
} from './data/storage/opfsWorkerClient.svelte'

// Re-export OPFS Worker Client
export {
    initOPFSWorker,
    saveToWorker,
    loadFromWorker,
    listFromWorker,
    listWithSizesFromWorker,
    deleteFromWorker,
    isWorkerReady
} from './data/storage/opfsWorkerClient.svelte'

// Re-export fetch utilities
export {
    globalFetch,
    fetchNative,
    addFetchLog,
    getFetchData,
    getRequestLog,
    textifyReadableStream,
    AppendableBuffer,
    type GlobalFetchArgs,
    type GlobalFetchResult
} from './utils/fetch';

export const forageStorage = new AutoStorage()
export const googleBuild = false

const appWindow = isTauri ? getCurrentWebviewWindow() : null

export async function downloadFile(name:string, dat:Uint8Array|ArrayBuffer|string) {
    if(typeof(dat) === 'string'){
        dat = Buffer.from(dat, 'utf-8')
    }
    const data = new Uint8Array(dat)

    if(isTauri && !isMobileTauri){
        // Desktop Tauri: write to Downloads folder
        await writeFile(name, data, {baseDir: BaseDirectory.Download})
    }
    else if(isMobileTauri){
        // Mobile Tauri: use Rust commands to write to /storage/emulated/0/Download/
        const { invoke } = await import('@tauri-apps/api/core')
        const path = await invoke('create_download_file', { filename: name })
        await invoke('append_download_file', { path, data: Array.from(data) })
    }
    else{
        // Web: use blob download
        const blob = new Blob([data], { type: 'application/octet-stream' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = name
        document.body.appendChild(a)
        a.style.display = 'none'
        a.click()
        a.remove()
        setTimeout(() => {
            URL.revokeObjectURL(url)
        }, 10000)
    }
}

let fileCache:{
    origin: string[], res:(Uint8Array|'loading'|'done')[]
} = {
    origin: [],
    res: []
}

// 에셋 파일 캐시 (IndexedDB 로드 결과를 캐싱)
const assetFileCache: { [key: string]: string | 'loading' | null } = {}

/**
 * Gets the source URL of a file.
 *
 * @param {string} loc - The location of the file.
 * @returns {Promise<string>} - A promise that resolves to the source URL of the file.
 */
export async function getFileSrc(loc:string) {
    if(isTauri){
        if(loc.startsWith('assets')){
            // 캐시 확인
            const cached = assetFileCache[loc]
            if (cached && cached !== 'loading') {
                return cached
            }
            if (cached === 'loading') {
                // 다른 호출이 로딩 중이면 대기
                while (assetFileCache[loc] === 'loading') {
                    await sleep(10)
                }
                return assetFileCache[loc] || ''
            }

            // 로딩 시작
            assetFileCache[loc] = 'loading'

            // IndexedDB (forageStorage)에서 로드
            try {
                const data = await forageStorage.getItem(loc) as unknown as Uint8Array
                if (data && data.byteLength > 0) {
                    const dataUrl = `data:image/png;base64,${Buffer.from(data).toString('base64')}`
                    assetFileCache[loc] = dataUrl
                    return dataUrl
                }
            } catch (e) {
                // IndexedDB 실패 시 무시하고 폴백
            }

            // 폴백: 기존 Tauri fs (마이그레이션 전 레거시 데이터용)
            if(appDataDirPath === ''){
                appDataDirPath = await appDataDir();
            }
            const joined = await join(appDataDirPath, loc)
            const result = convertFileSrc(joined)
            assetFileCache[loc] = result
            return result
        }
        return convertFileSrc(loc)
    }
    if(forageStorage.isAccount && loc.startsWith('assets')){
        return hubURL + `/rs/` + loc
    }
    try {
        if(navigator.serviceWorker){
            const encoded = Buffer.from(loc,'utf-8').toString('hex')
            let ind = fileCache.origin.indexOf(loc)
            if(ind === -1){
                ind = fileCache.origin.length 
                fileCache.origin.push(loc)
                fileCache.res.push('loading')
                try {
                    const hasCache:boolean = (await (await fetch("/sw/check/" + encoded)).json()).able
                    if(hasCache){
                        fileCache.res[ind] = 'done'
                        return "/sw/img/" + encoded
                    }
                    else{
                        const f:Uint8Array = await forageStorage.getItem(loc) as unknown as Uint8Array
                        await fetch("/sw/register/" + encoded, {
                            method: "POST",
                            body: f as any
                        })
                        fileCache.res[ind] = 'done'
                        await sleep(10)
                    }
                    return "/sw/img/" + encoded   
                } catch (error) {

                }
            }
            else{
                const f = fileCache.res[ind]
                if(f === 'loading'){
                    while(fileCache.res[ind] === 'loading'){
                        await sleep(10)
                    }
                }
                return "/sw/img/" + encoded
            }
        }
        else{
            let ind = fileCache.origin.indexOf(loc)
            if(ind === -1){
                ind = fileCache.origin.length 
                fileCache.origin.push(loc)
                fileCache.res.push('loading')
                const f:Uint8Array = await forageStorage.getItem(loc) as unknown as Uint8Array
                fileCache.res[ind] = f
                return `data:image/png;base64,${Buffer.from(f).toString('base64')}`  
            }
            else{
                const f = fileCache.res[ind]
                if(f === 'loading'){
                    while(fileCache.res[ind] === 'loading'){
                        await sleep(10)
                    }
                    return `data:image/png;base64,${Buffer.from(fileCache.res[ind]).toString('base64')}`  
                }
                return `data:image/png;base64,${Buffer.from(f).toString('base64')}`  
            }
        }
    } catch (error) {
        console.error(error)
        return ''
    }
}

let appDataDirPath = ''

/**
 * Reads an image file and returns its data.
 * 
 * @param {string} data - The path to the image file.
 * @returns {Promise<Uint8Array<ArrayBuffer> | null>} - A promise that resolves to the data of the image file.
 */
export async function readImage(data:string): Promise<Uint8Array<ArrayBuffer> | null> {
    // Assets are stored in IndexedDB (forageStorage) for all platforms
    const result = await forageStorage.getItem(data) as unknown as Uint8Array<ArrayBuffer>
    if (result) {
        return result
    }
    // Fallback to Tauri fs for legacy data
    if(isTauri){
        try {
            if(data.startsWith('assets')){
                if(appDataDirPath === ''){
                    appDataDirPath = await appDataDir();
                }
                return await readFile(await join(appDataDirPath,data)) as Uint8Array<ArrayBuffer>
            }
            return await readFile(data) as Uint8Array<ArrayBuffer>
        } catch (e) {
            return null
        }
    }
    return null
}

/**
 * Saves an asset file with the given data, custom ID, and file name.
 * 
 * @param {Uint8Array} data - The data of the asset file.
 * @param {string} [customId=''] - The custom ID for the asset file.
 * @param {string} [fileName=''] - The name of the asset file.
 * @returns {Promise<string>} - A promise that resolves to the path of the saved asset file.
 */
export async function saveAsset(data:Uint8Array<ArrayBuffer>, customId:string = '', fileName:string = ''){
    let id = ''
    if(customId !== ''){
        id = customId
    }
    else{
        try {
            id = await hasher(data)
        } catch (error) {
            id = uuidv4()
        }
    }
    let fileExtension:string = 'png'
    if(fileName && fileName.split('.').length > 0){
        fileExtension = fileName.split('.').pop()
    }
    let form = `assets/${id}.${fileExtension}`
    // Tauri와 웹 모두 IndexedDB (forageStorage) 사용
    const replacer = await forageStorage.setItem(form, data)
    if(replacer){
        return replacer
    }
    return form
}

/**
 * Loads an asset file with the given ID.
 * 
 * @param {string} id - The ID of the asset file to load.
 * @returns {Promise<Uint8Array<ArrayBuffer> | null>} - A promise that resolves to the data of the loaded asset file.
 */
export async function loadAsset(id:string): Promise<Uint8Array<ArrayBuffer> | null> {
    // Tauri와 웹 모두 IndexedDB (forageStorage) 사용
    const data = await forageStorage.getItem(id) as unknown as Uint8Array<ArrayBuffer>
    if (data) {
        return data
    }
    // 폴백: Tauri fs (마이그레이션 전 레거시 데이터용)
    if (isTauri) {
        try {
            return await readFile(id, {baseDir: BaseDirectory.AppData}) as Uint8Array<ArrayBuffer>
        } catch {
            return null
        }
    }
    return null
}

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

/**
 * Retrieves unpargeable resources from the database.
 * 
 * @param {Database} db - The database to retrieve unpargeable resources from.
 * @param {'basename'|'pure'} [uptype='basename'] - The type of unpargeable resources to retrieve.
 * @returns {string[]} - An array of unpargeable resources.
 */
export function getUnpargeables(db: Database, uptype: 'basename' | 'pure' = 'basename') {
    const unpargeable = new Set<string>();

    /**
     * Adds a resource to the unpargeable list if it is not already included.
     * 
     * @param {string} data - The resource to add.
     */
    function addUnparge(data: string) {
        if (!data) {
            return;
        }
        if (data === '') {
            return;
        }
        const bn = uptype === 'basename' ? getBasename(data) : data;
        unpargeable.add(bn);
    }

    addUnparge(db.customBackground);
    addUnparge(db.userIcon);

    for (const cha of db.characters) {
        if (cha.image) {
            addUnparge(cha.image);
        }
        if (cha.emotionImages) {
            for (const em of cha.emotionImages) {
                addUnparge(em[1]);
            }
        }
        if (cha.type !== 'group') {
            if (cha.additionalAssets) {
                for (const em of cha.additionalAssets) {
                    addUnparge(em[1]);
                }
            }
            if (cha.vits) {
                const keys = Object.keys(cha.vits.files);
                for (const key of keys) {
                    const vit = cha.vits.files[key];
                    addUnparge(vit);
                }
            }
            if (cha.ccAssets) {
                for (const asset of cha.ccAssets) {
                    addUnparge(asset.uri);
                }
            }
        }
    }

    if(db.modules){
        for(const module of db.modules){
            const assets = module.assets
            if(assets){
                for(const asset of assets){
                    addUnparge(asset[1])
                }
            }
        }
    }

    if(db.personas){
        db.personas.map((v) => {
            addUnparge(v.icon);
        });
    }

    if(db.characterOrder){
        db.characterOrder.forEach((item) => {
            if (typeof item === 'object' && 'imgFile' in item) {
                addUnparge(item.imgFile);
            }
        })
    }
    return Array.from(unpargeable);
}


/**
 * Replaces database resources with the provided replacer object.
 * 
 * @param {Database} db - The database object containing resources to be replaced.
 * @param {{[key: string]: string}} replacer - An object mapping original resource keys to their replacements.
 * @returns {Database} - The updated database object with replaced resources.
 */
export function replaceDbResources(db: Database, replacer: { [key: string]: string }): Database {
    let unpargeable: string[] = [];

    /**
     * Replaces a given data string with its corresponding value from the replacer object.
     * 
     * @param {string} data - The data string to be replaced.
     * @returns {string} - The replaced data string or the original data if no replacement is found.
     */
    function replaceData(data: string): string {
        if (!data) {
            return data;
        }
        return replacer[data] ?? data;
    }

    db.customBackground = replaceData(db.customBackground);
    db.userIcon = replaceData(db.userIcon);

    for (const cha of db.characters) {
        if (cha.image) {
            cha.image = replaceData(cha.image);
        }
        if (cha.emotionImages) {
            for (let i = 0; i < cha.emotionImages.length; i++) {
                cha.emotionImages[i][1] = replaceData(cha.emotionImages[i][1]);
            }
        }
        if (cha.type !== 'group') {
            if (cha.additionalAssets) {
                for (let i = 0; i < cha.additionalAssets.length; i++) {
                    cha.additionalAssets[i][1] = replaceData(cha.additionalAssets[i][1]);
                }
            }
        }
    }
    return db;
}

/**
 * Checks and updates the character order in the database.
 * Ensures that all characters are properly ordered and removes any invalid entries.
 */
export function checkCharOrder() {
    let db = getDatabase()
    db.characterOrder = db.characterOrder ?? []
    let ordered = []
    for(let i=0;i<db.characterOrder.length;i++){
        const folder =db.characterOrder[i]
        if(typeof(folder) !== 'string' && folder){
            for(const f of folder.data){
                ordered.push(f)
            }
        }
        if(typeof(folder) === 'string'){
            ordered.push(folder)
        }
    }

    let charIdList:string[] = []

    for(let i=0;i<db.characters.length;i++){
        const char = db.characters[i]
        const charId = char.chaId
        if(!char.trashTime){
            charIdList.push(charId)
        }
        if(!ordered.includes(charId)){
            if(charId !== '§temp' && charId !== '§playground' && !char.trashTime){
                db.characterOrder.push(charId)
            }
        }
    }


    for(let i=0;i<db.characterOrder.length;i++){
        const data =db.characterOrder[i]
        if(typeof(data) !== 'string'){
            if(!data){
                db.characterOrder.splice(i,1)
                i--;
                continue
            }
            if(data.data.length === 0){
                db.characterOrder.splice(i,1)
                i--;
                continue
            }
            for(let i2=0;i2<data.data.length;i2++){
                const data2 = data.data[i2]
                if(!charIdList.includes(data2)){
                    data.data.splice(i2,1)
                    i2--;
                }
            }
            db.characterOrder[i] = data
        }
        else{
            if(!charIdList.includes(data)){
                db.characterOrder.splice(i,1)
                i--;
            }
        }
    }


    setDatabase(db)
}

/**
 * Opens a URL in the appropriate environment.
 * 
 * @param {string} url - The URL to open.
 */
export function openURL(url:string){
    if(isTauri){
        open(url)
    }
    else{
        window.open(url, "_blank")
    }
}

/**
 * Converts FormData to a URL-encoded string.
 * 
 * @param {FormData} formData - The FormData to convert.
 * @returns {string} The URL-encoded string.
 */
function formDataToString(formData: FormData): string {
    const params: string[] = [];
  
    for (const [name, value] of formData.entries()) {
      params.push(`${encodeURIComponent(name)}=${encodeURIComponent(value.toString())}`);
    }
  
    return params.join('&');
}

/**
 * Gets the maximum context length for a given model.
 * 
 * @param {string} model - The model name.
 * @returns {number|undefined} The maximum context length, or undefined if the model is not recognized.
 */
export function getModelMaxContext(model:string):number|undefined{
    if(model.startsWith('gpt35')){
        if(model.includes('16k')){
            return 16000
        }
        return 4000
    }
    if(model.startsWith('gpt4')){
        if(model.includes('turbo')){
            return 128000 
        }
        if(model.includes('32k')){
            return 32000
        }
        return 8000
    }

    return undefined
}

/**
 * A writer class for Tauri environment.
 */
export class TauriWriter{
    path: string
    firstWrite: boolean = true

    /**
     * Creates an instance of TauriWriter.
     *
     * @param {string} path - The file path to write to.
     */
    constructor(path: string){
        this.path = path
    }

    /**
     * Writes data to the file.
     *
     * @param {Uint8Array} data - The data to write.
     */
    async write(data:Uint8Array) {
        await writeFile(this.path, data, {
            append: !this.firstWrite
        })
        this.firstWrite = false
    }

    /**
     * Closes the writer. (No operation for TauriWriter)
     */
    async close(){
        // do nothing
    }
}

/**
 * A streaming writer for mobile Tauri that writes directly to Android's Downloads folder.
 * Uses Rust commands for efficient file I/O without buffering in JS memory.
 */
export class MobileTauriWriter{
    filename: string
    filePath: string | null = null

    constructor(filename: string){
        this.filename = filename
    }

    async write(data:Uint8Array) {
        const { invoke } = await import('@tauri-apps/api/core')

        if (!this.filePath) {
            // First write: create file
            this.filePath = await invoke('create_download_file', {
                filename: this.filename
            }) as string
        }

        // Append data
        await invoke('append_download_file', {
            path: this.filePath,
            data: Array.from(data)
        })
    }

    async close(){
        // File is already written, nothing to do
    }
}

/**
 * Class representing a local writer.
 */
export class LocalWriter {
    writer: WritableStreamDefaultWriter | TauriWriter | MobileTauriWriter

    /**
     * Initializes the writer.
     *
     * @param {string} [name='Binary'] - The name of the file.
     * @param {string[]} [ext=['bin']] - The file extensions.
     * @returns {Promise<boolean>} - A promise that resolves to a boolean indicating success.
     */
    async init(name = 'Binary', ext = ['bin']): Promise<boolean> {
        if (isTauri && !isMobileTauri) {
            // Desktop Tauri: use native save dialog + streaming writer
            const filePath = await save({
                filters: [{
                    name: name,
                    extensions: ext
                }]
            });
            if (!filePath) {
                return false
            }
            this.writer = new TauriWriter(filePath)
            return true
        }
        if (isMobileTauri) {
            // Mobile Tauri: streaming write to /storage/emulated/0/Download/
            this.writer = new MobileTauriWriter(name + '.' + ext[0])
            return true
        }
        // Web: use streamsaver
        const streamSaver = await import('streamsaver')
        const writableStream = streamSaver.createWriteStream(name + '.' + ext[0])
        this.writer = writableStream.getWriter()
        return true
    }

    /**
     * Writes backup data to the file.
     * 
     * @param {string} name - The name of the backup.
     * @param {Uint8Array} data - The data to write.
     */
    async writeBackup(name: string, data: Uint8Array): Promise<void> {
        const encodedName = new TextEncoder().encode(getBasename(name))
        const nameLength = new Uint32Array([encodedName.byteLength])
        await this.writer.write(new Uint8Array(nameLength.buffer))
        await this.writer.write(encodedName)
        const dataLength = new Uint32Array([data.byteLength])
        await this.writer.write(new Uint8Array(dataLength.buffer))
        await this.writer.write(data)
    }

    /**
     * Writes data to the file.
     * 
     * @param {Uint8Array} data - The data to write.
     */
    async write(data: Uint8Array): Promise<void> {
        await this.writer.write(data)
    }

    /**
     * Closes the writer.
     */
    async close(): Promise<void> {
        await this.writer.close()
    }
}

/**
 * Class representing a virtual writer.
 */
export class VirtualWriter {
    buf = new AppendableBuffer()

    /**
     * Writes data to the buffer.
     * 
     * @param {Uint8Array} data - The data to write.
     */
    async write(data: Uint8Array): Promise<void> {
        this.buf.append(data)
    }

    /**
     * Closes the writer. (No operation for VirtualWriter)
     */
    async close(): Promise<void> {
        // do nothing
    }
}

/**
 * Toggles the fullscreen mode of the document.
 * If the document is currently in fullscreen mode, it exits fullscreen.
 * If the document is not in fullscreen mode, it requests fullscreen with navigation UI hidden.
 */
export function toggleFullscreen(){
    const fullscreenElement = document.fullscreenElement
    fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen({
        navigationUI: "hide"
    })
}

/**
 * Removes non-Latin characters from a string, replaces multiple spaces with a single space, and trims the string.
 * 
 * @param {string} data - The input string to be processed.
 * @returns {string} The processed string with non-Latin characters removed, multiple spaces replaced by a single space, and trimmed.
 */
export function trimNonLatin(data:string){
    return data .replace(/[^\x00-\x7F]/g, "")
                .replace(/ +/g, ' ')
                .trim()
}

/**
 * Updates the height mode of the document based on the value stored in the database.
 * 
 * The height mode can be one of the following values: 'auto', 'vh', 'dvh', 'lvh', 'svh', or 'percent'.
 * The corresponding CSS variable '--risu-height-size' is set accordingly.
 */
export function updateHeightMode(){
    const db = getDatabase()
    const root = document.querySelector(':root') as HTMLElement;
    switch(db.heightMode){
        case 'auto':
            root.style.setProperty('--risu-height-size', '100%');
            break
        case 'vh':
            root.style.setProperty('--risu-height-size', '100vh');
            break
        case 'dvh':
            root.style.setProperty('--risu-height-size', '100dvh');
            break
        case 'lvh':
            root.style.setProperty('--risu-height-size', '100lvh');
            break
        case 'svh':
            root.style.setProperty('--risu-height-size', '100svh');
            break
        case 'percent':
            root.style.setProperty('--risu-height-size', '100%');
            break
    }
}

/**
 * A class that provides a blank writer implementation.
 * 
 * This class is used to provide a no-op implementation of a writer, making it compatible with other writer interfaces.
 */
export class BlankWriter{
    constructor(){
    }

    /**
     * Initializes the writer.
     * 
     * This method does nothing and is provided for compatibility with other writer interfaces.
     */
    async init(){
        //do nothing, just to make compatible with other writer
    }

    /**
     * Writes data to the writer.
     * 
     * This method does nothing and is provided for compatibility with other writer interfaces.
     * 
     * @param {string} key - The key associated with the data.
     * @param {Uint8Array|string} data - The data to be written.
     */
    async write(key:string,data:Uint8Array|string){
        //do nothing, just to make compatible with other writer
    }

    /**
     * Ends the writing process.
     * 
     * This method does nothing and is provided for compatibility with other writer interfaces.
     */
    async end(){
        //do nothing, just to make compatible with other writer
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

/**
 * A debugging class for performance measurement.
*/

export class PerformanceDebugger{
    kv:{[key:string]:number[]} = {}
    startTime:number
    endTime:number

    /**
     * Starts the timing measurement.
    */
    start(){
        this.startTime = performance.now()
    }

    /**
     * Ends the timing measurement and records the time difference.
     * 
     * @param {string} key - The key to associate with the recorded time.
    */
    endAndRecord(key:string){
        this.endTime = performance.now()
        if(!this.kv[key]){
            this.kv[key] = []
        }
        this.kv[key].push(this.endTime - this.startTime)
    }

    /**
     * Ends the timing measurement, records the time difference, and starts a new timing measurement.
     * 
     * @param {string} key - The key to associate with the recorded time.
    */
    endAndRecordAndStart(key:string){
        this.endAndRecord(key)
        this.start()
    }

    /**
     * Logs the average time for each key to the console.
    */
    log(){
        let table:{[key:string]:number} = {}

        for(const key in this.kv){
            table[key] = this.kv[key].reduce((a,b) => a + b, 0) / this.kv[key].length
        }


        console.table(table)
    }

    combine(other:PerformanceDebugger){
        for(const key in other.kv){
            if(!this.kv[key]){
                this.kv[key] = []
            }
            this.kv[key].push(...other.kv[key])
        }
    }
}

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

export function getVersionString(): string {
    let versionString = appVer
    if(window.location.hostname === 'nightly.risuai.xyz'){
        versionString = 'Nightly Build'
    }
    if(window.location.hostname === 'stable.risuai.xyz'){
        versionString += ' (Stable)';
    }
    return versionString
}
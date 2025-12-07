import { sleep } from "./utils/util"
import { getDbBackups } from "./init"
import { v4 } from 'uuid';
import { getDatabase } from "./data/storage/database.svelte";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { selectedCharID, DBState } from "./stores.svelte";
import { alertConfirm, alertNormalWait } from "./utils/alert";
import { syncDrive } from "./data/drive/drive";
import { RisuSaveEncoder, type toSaveType } from "./data/storage/risuSave";
import { loadChat, saveChat } from "./data/storage/chatStorage";
import { saveMainData } from "./data/storage/dbStorage";
import { forageStorage } from "./data/storage/autoStorage";
import { saveDbKei } from "./data/kei/backup";
import { language } from "src/lang";
import { isTauri } from "src/ts/utils/env";
import { initOPFSWorker } from './data/storage/opfsWorkerClient.svelte'


const appWindow = isTauri ? getCurrentWebviewWindow() : null

let lastSave = ''
let lastBackupTime = 0
export let saving = $state({
    state: false,
    paused: false  // 백업 복원 중 저장 일시정지
})

// Re-export for backwards compatibility
export { loadChat, saveChat } from "./data/storage/chatStorage";

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
            const now = Date.now()
            const intervalMs = (db.dbBackupIntervalMinutes ?? 10) * 60 * 1000
            const shouldBackup = (now - lastBackupTime) >= intervalMs

            // Delegate to dbStorage for actual file saving
            const result = await saveMainData({
                db,
                dbData,
                toSave,
                shouldExcludeChats,
                shouldSeparateCharactersAndPresets,
                shouldBackup,
                now
            })

            if (result.backedUp) {
                lastBackupTime = now
            }

            // Account mode delay
            if (forageStorage.isAccount) {
                await sleep(3000)
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


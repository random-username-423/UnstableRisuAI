import {
    writeFile,
    BaseDirectory,
    readFile,
    exists
} from "@tauri-apps/plugin-fs"
import { changeFullscreen, checkNullish, findCharacterbyId, sleep } from "./util"
import { convertFileSrc } from "@tauri-apps/api/core"
import { v4 as uuidv4, v4 } from 'uuid';
import { appDataDir, join } from "@tauri-apps/api/path";
import { get } from "svelte/store";
import {open} from '@tauri-apps/plugin-shell'
import { setDatabase, type Database, defaultSdDataFunc, getDatabase, type character, appVer } from "./storage/database.svelte";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { checkRisuUpdate } from "./update";
import { MobileGUI, botMakerMode, selectedCharID, loadedStore, DBState, LoadingStatusState } from "./stores.svelte";
import { loadPlugins } from "./plugins/plugins";
import { alertConfirm, alertError, alertMd, alertNormal, alertNormalWait, alertSelect, alertTOS, alertWait, waitAlert } from "./alert";
import { checkDriverInit, syncDrive } from "./drive/drive";
import { hasher } from "./parser.svelte";
import { characterURLImport, hubURL } from "./characterCards";
import { defaultJailbreak, defaultMainPrompt, oldJailbreak, oldMainPrompt } from "./storage/defaultPrompts";
import { loadRisuAccountData } from "./drive/accounter";
import { decodeRisuSave, encodeRisuSaveCompressionStream, encodeRisuSaveLegacy, RisuSaveEncoder, type toSaveType } from "./storage/risuSave";
import { AutoStorage } from "./storage/autoStorage";
import { updateAnimationSpeed } from "./gui/animation";
import { updateColorScheme, updateTextThemeAndCSS } from "./gui/colorscheme";
import { autoServerBackup, saveDbKei } from "./kei/backup";
import { Capacitor } from '@capacitor/core';
import * as CapFS from '@capacitor/filesystem'
import { save } from "@tauri-apps/plugin-dialog";
import { language } from "src/lang";
import { startObserveDom } from "./observer.svelte";
import { updateGuisize } from "./gui/guisize";
import { encodeCapKeySafe } from "./storage/mobileStorage";
import { updateLorebooks } from "./characters";
import { initMobileGesture } from "./hotkey";
import { moduleUpdate } from "./process/modules";
import type { AccountStorage } from "./storage/accountStorage";
import { makeColdData } from "./process/coldstorage.svelte";
import { platform } from '@tauri-apps/plugin-os';
import { migrateOPFSAssetsToIndexedDB, migrateTauriFsAssetsToIndexedDB, migrateWebDBtoOPFS } from './storage/migration';
import { AppendableBuffer } from './fetch';

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
} from './fetch';

//@ts-ignore
export const isTauri = !!window.__TAURI_INTERNALS__
//@ts-ignore
export const isNodeServer = !!globalThis.__NODE__
export const forageStorage = new AutoStorage()
export const googleBuild = false
export const isMobile = navigator.userAgent.match(/(iPad)|(iPhone)|(iPod)|(android)|(webOS)/i)

const appWindow = isTauri ? getCurrentWebviewWindow() : null

export async function downloadFile(name:string, dat:Uint8Array|ArrayBuffer|string) {
    if(typeof(dat) === 'string'){
        dat = Buffer.from(dat, 'utf-8')
    }
    const data = new Uint8Array(dat)
    const downloadURL = (data:string, fileName:string) => {
        const a = document.createElement('a')
        a.href = data
        a.download = fileName
        document.body.appendChild(a)
        a.style.display = 'none'
        a.click()
        a.remove()
    }

    if(isTauri){
        await writeFile(name, data, {baseDir: BaseDirectory.Download})
    }
    else{
        const blob = new Blob([data], { type: 'application/octet-stream' })
        const url = URL.createObjectURL(blob)

        downloadURL(url, name)

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

/**
 * Checks if a file exists in the Capacitor filesystem.
 * 
 * @param {CapFS.GetUriOptions} getUriOptions - The options for getting the URI of the file.
 * @returns {Promise<boolean>} - A promise that resolves to true if the file exists, false otherwise.
 */
async function checkCapFileExists(getUriOptions: CapFS.GetUriOptions): Promise<boolean> {
    try {
        await CapFS.Filesystem.stat(getUriOptions);
        return true;
    } catch (checkDirException) {
        if (checkDirException.message === 'File does not exist') {
            return false;
        } else {
            throw checkDirException;
        }
    }
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
    if(Capacitor.isNativePlatform()){
        if(!await checkCapFileExists({
            path: encodeCapKeySafe(loc),
            directory: CapFS.Directory.External
        })){
            return ''
        }
        const uri = await CapFS.Filesystem.getUri({
            path: encodeCapKeySafe(loc),
            directory: CapFS.Directory.External
        })
        return Capacitor.convertFileSrc(uri.uri)
    }
    try {
        if(usingSw){
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
 * @returns {Promise<Uint8Array>} - A promise that resolves to the data of the image file.
 */
export async function readImage(data:string) {
    if(isTauri){
        if(data.startsWith('assets')){
            if(appDataDirPath === ''){
                appDataDirPath = await appDataDir();
            }
            return await readFile(await join(appDataDirPath,data))
        }
        return await readFile(data)
    }
    else{
        return (await forageStorage.getItem(data) as unknown as Uint8Array)
    }
}

/**
 * Saves an asset file with the given data, custom ID, and file name.
 * 
 * @param {Uint8Array} data - The data of the asset file.
 * @param {string} [customId=''] - The custom ID for the asset file.
 * @param {string} [fileName=''] - The name of the asset file.
 * @returns {Promise<string>} - A promise that resolves to the path of the saved asset file.
 */
export async function saveAsset(data:Uint8Array, customId:string = '', fileName:string = ''){
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
 * @returns {Promise<Uint8Array>} - A promise that resolves to the data of the loaded asset file.
 */
export async function loadAsset(id:string){
    // Tauri와 웹 모두 IndexedDB (forageStorage) 사용
    const data = await forageStorage.getItem(id) as unknown as Uint8Array
    if (data) {
        return data
    }
    // 폴백: Tauri fs (마이그레이션 전 레거시 데이터용)
    if (isTauri) {
        try {
            return await readFile(id, {baseDir: BaseDirectory.AppData})
        } catch {
            return null
        }
    }
    return null
}

let lastSave = ''
let lastBackupTime = 0
export let saving = $state({
    state: false
})

// OPFS/IndexedDB Worker (모듈 레벨)
// Tauri: OPFS Worker (IPC 블로킹 방지)
// Web: IndexedDB Worker
let opfsWorker: Worker | null = null
let opfsWorkerReady = false
let pendingSaves = new Map<string, { resolve: () => void, reject: (e: Error) => void }>()
let pendingLoads = new Map<string, { resolve: (data: Uint8Array | null) => void, reject: (e: Error) => void }>()
let pendingLists = new Map<string, { resolve: (files: string[]) => void, reject: (e: Error) => void }>()
let pendingDeletes = new Map<string, { resolve: () => void, reject: (e: Error) => void }>()

export async function initOPFSWorker(): Promise<void> {
    if (opfsWorker || isNodeServer) return

    try {
        // Vite의 ?worker 쿼리로 Worker 번들링
        // Tauri와 Web 모두 OPFS Worker 사용 (DB 저장용)
        const OPFSWorker = await import('./storage/opfsSaveWorker?worker')
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
        }
        opfsWorker.onerror = (e) => {
            console.error('OPFS worker error:', e)
        }
        console.log('[OPFS] Worker initialized successfully')
    } catch (e) {
        console.warn('Failed to initialize OPFS worker, falling back to main thread:', e)
        opfsWorker = null
        opfsWorkerReady = false
    }
}

export async function saveToWorker(key: string, data: Uint8Array): Promise<void> {
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
    await encoder.init(getDatabase(), {
        compression: forageStorage.isAccount
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
                $state.snapshot(DBState.db.characters[selIdState].chats)
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
        if(!changed){
            await sleep(500)
            continue
        }

        saving.state = true
        changed = false
        try {

            if(requiresFullEncoderReload.state){
                encoder = new RisuSaveEncoder()
                await encoder.init(getDatabase(), {
                    compression: forageStorage.isAccount
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

            if(!forageStorage.isAccount && opfsWorker){
                // 백업용 복사본 생성 (Transferable로 보내면 원본 buffer가 detached됨)
                const backupData = new Uint8Array(dbData)
                await saveToWorker('database/database.bin', dbData)
                if(shouldBackup){
                    await saveToWorker(`database/dbbackup-${(now/100).toFixed()}.bin`, backupData)
                    lastBackupTime = now
                }
            }
            else{
                await forageStorage.setItem('database/database.bin', dbData)
                if(!forageStorage.isAccount && shouldBackup){
                    await forageStorage.setItem(`database/dbbackup-${(now/100).toFixed()}.bin`, dbData)
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
 * Retrieves the database backups.
 * 
 * @returns {Promise<number[]>} - A promise that resolves to an array of backup timestamps.
 */
async function getDbBackups() {
    let db = getDatabase()
    if(db?.account?.useSync && !isTauri && !isNodeServer){
        return []
    }
    // Both Tauri and web use OPFS for database storage now
    const files = await listFromWorker('database')

    const backups = files
      .filter(file => file.startsWith('dbbackup-'))
      .map(file => parseInt(file.slice(9, -4)))
      .sort((a, b) => b - a);

    const maxBackups = db.maxDbBackups ?? 20
    while(backups.length > maxBackups){
        const last = backups.pop()
        await deleteFromWorker(`database/dbbackup-${last}.bin`)
    }
    return backups
}

let usingSw = false

/**
 * Loads the application data.
 *
 * @returns {Promise<void>} - A promise that resolves when the data has been loaded.
 */
export async function loadData() {
    const loaded = get(loadedStore)
    if(!loaded){
        try {
            if(isTauri){
                LoadingStatusState.text = "Checking Files..."

                // 모바일 체크 추가
                const currentPlatform = await platform();
                const isMobile = currentPlatform === 'android' || currentPlatform === 'ios';

                if(!isMobile){
                    appWindow.maximize()
                }

                // OPFS Worker 초기화 (ready 신호까지 대기)
                await initOPFSWorker()

                // OPFS → IndexedDB 에셋 마이그레이션 (최초 1회)
                LoadingStatusState.text = "Checking asset migration..."
                await migrateOPFSAssetsToIndexedDB()

                // Tauri fs → IndexedDB 에셋 마이그레이션 (레거시 데이터용)
                await migrateTauriFsAssetsToIndexedDB()

                // OPFS에서 먼저 로드 시도
                LoadingStatusState.text = "Reading Save File..."
                let readed = await loadFromWorker('database/database.bin')

                // OPFS에 데이터가 없으면 기존 파일시스템에서 마이그레이션
                if (!readed) {
                    console.log('[OPFS] No data in OPFS, checking filesystem for migration...')
                    if (await exists('database/database.bin', {baseDir: BaseDirectory.AppData})) {
                        LoadingStatusState.text = "Migrating from filesystem to OPFS..."
                        readed = await readFile('database/database.bin', {baseDir: BaseDirectory.AppData})
                        console.log('[OPFS] Migrated data from filesystem')
                    }
                }

                // 데이터가 없으면 새로 생성
                if (!readed) {
                    console.log('[OPFS] No existing data, creating new database')
                    readed = encodeRisuSaveLegacy({})
                }

                try {
                    LoadingStatusState.text = "Cleaning Unnecessary Files..."
                    getDbBackups() //this also cleans the backups
                    LoadingStatusState.text = "Decoding Save File..."
                    const decoded = await decodeRisuSave(readed)
                    setDatabase(decoded)
                } catch (error) {
                    LoadingStatusState.text = "Reading Backup Files..."
                    const backups = await getDbBackups()
                    let backupLoaded = false
                    for(const backup of backups){
                        if (!backupLoaded) {
                            try {
                                LoadingStatusState.text = `Reading Backup File ${backup}...`
                                // OPFS에서 백업 로드 시도
                                let backupData = await loadFromWorker(`database/dbbackup-${backup}.bin`)
                                // OPFS에 없으면 파일시스템에서 시도
                                if (!backupData && await exists(`database/dbbackup-${backup}.bin`, {baseDir: BaseDirectory.AppData})) {
                                    backupData = await readFile(`database/dbbackup-${backup}.bin`, {baseDir: BaseDirectory.AppData})
                                }
                                if (backupData) {
                                    setDatabase(
                                      await decodeRisuSave(backupData)
                                    )
                                    backupLoaded = true
                                }
                            } catch (error) {
                                console.error(error)
                            }
                        }
                    }
                    if(!backupLoaded){
                        throw "Your save file is corrupted"
                    }
                }
                LoadingStatusState.text = "Checking Update..."
                await checkRisuUpdate()
                await changeFullscreen()

            }
            else{
                await forageStorage.Init()

                // OPFS Worker 초기화 (웹에서도 DB 저장용으로 사용)
                await initOPFSWorker()

                // IndexedDB → OPFS DB 마이그레이션 (최초 1회)
                LoadingStatusState.text = "Checking DB migration..."
                await migrateWebDBtoOPFS()

                // OPFS에서 DB 로드
                LoadingStatusState.text = "Loading Local Save File..."
                let gotStorage:Uint8Array = await loadFromWorker('database/database.bin')
                LoadingStatusState.text = "Decoding Local Save File..."
                if(checkNullish(gotStorage)){
                    gotStorage = encodeRisuSaveLegacy({})
                    await saveToWorker('database/database.bin', gotStorage)
                }
                try {
                    const decoded = await decodeRisuSave(gotStorage)
                    console.log(decoded)
                    setDatabase(decoded)
                } catch (error) {
                    console.error(error)
                    const backups = await getDbBackups()
                    let backupLoaded = false
                    for(const backup of backups){
                        try {
                            LoadingStatusState.text = `Reading Backup File ${backup}...`
                            const backupData:Uint8Array = await loadFromWorker(`database/dbbackup-${backup}.bin`)
                            if (backupData) {
                                setDatabase(
                                    await decodeRisuSave(backupData)
                                )
                                backupLoaded = true
                            }
                        } catch (error) {}
                    }
                    if(!backupLoaded){
                        throw "Forage: Your save file is corrupted"
                    }
                }

                if(await forageStorage.checkAccountSync()){
                    LoadingStatusState.text = "Checking Account Sync..."
                    let gotStorage:Uint8Array = await (forageStorage.realStorage as AccountStorage).getItem('database/database.bin', (v) => {
                        LoadingStatusState.text = `Loading Remote Save File ${(v*100).toFixed(2)}%`
                    })
                    if(checkNullish(gotStorage)){
                        gotStorage = encodeRisuSaveLegacy({})
                        await forageStorage.setItem('database/database.bin', gotStorage)
                    }
                    try {
                        setDatabase(
                            await decodeRisuSave(gotStorage)
                        )
                    } catch (error) {
                        const backups = await getDbBackups()
                        let backupLoaded = false
                        for(const backup of backups){
                            try {
                                LoadingStatusState.text = `Reading Backup File ${backup}...`
                                const backupData:Uint8Array = await forageStorage.getItem(`database/dbbackup-${backup}.bin`) as unknown as Uint8Array
                                setDatabase(
                                    await decodeRisuSave(backupData)
                                )
                                backupLoaded = true
                            } catch (error) {}
                        }
                        if(!backupLoaded){
                            // throw "Your save file is corrupted"
                            await autoServerBackup()
                            await sleep(10000)
                        }
                    }
                }
                LoadingStatusState.text = "Rechecking Account Sync..."
                await forageStorage.checkAccountSync()
                LoadingStatusState.text = "Checking Drive Sync..."
                const isDriverMode = await checkDriverInit()
                if(isDriverMode){
                    return
                }
                LoadingStatusState.text = "Checking Service Worker..."
                if(navigator.serviceWorker && (!Capacitor.isNativePlatform())){
                    usingSw = true
                    await registerSw()
                }
                else{
                    usingSw = false
                }
                if(getDatabase().didFirstSetup){
                    characterURLImport()
                }
            }
            LoadingStatusState.text = "Checking Unnecessary Files..."
            try {
                await pargeChunks()
            } catch (error) {
                console.error(error)
            }
            LoadingStatusState.text = "Loading Plugins..."
            try {
                await loadPlugins()            
            } catch (error) {}
            if(getDatabase().account){
                LoadingStatusState.text = "Checking Account Data..."
                try {
                    await loadRisuAccountData()                    
                } catch (error) {}
            }
            try {
                //@ts-ignore
                const isInStandaloneMode = (window.matchMedia('(display-mode: standalone)').matches) || (window.navigator.standalone) || document.referrer.includes('android-app://');              
                if(isInStandaloneMode){
                    await navigator.storage.persist()
                }
            } catch (error) {
                
            }
            LoadingStatusState.text = "Checking For Format Update..."
            await checkNewFormat()
            const db = getDatabase();

            LoadingStatusState.text = "Updating States..."
            updateColorScheme()
            updateTextThemeAndCSS()
            updateAnimationSpeed()
            updateHeightMode()
            updateErrorHandling()
            updateGuisize()
            if(!localStorage.getItem('nightlyWarned') && window.location.hostname === 'nightly.risuai.xyz'){
                alertMd(language.nightlyWarning)
                await waitAlert()
                //for testing, leave empty
                localStorage.setItem('nightlyWarned', '')
            }
            if(db.botSettingAtStart){
                botMakerMode.set(true)
            }
            if((db.betaMobileGUI && window.innerWidth <= 800) || import.meta.env.VITE_RISU_LITE === 'TRUE'){
                initMobileGesture()
                MobileGUI.set(true)
            }
            loadedStore.set(true)
            selectedCharID.set(-1)
            startObserveDom()
            assignIds()
            makeColdData()
            saveDb()
            moduleUpdate()
            if(import.meta.env.VITE_RISU_TOS === 'TRUE'){
                alertTOS().then((a) => {
                    if(a === false){
                        location.reload()
                    }
                })
            }
        } catch (error) {
            alertError(error)
        }
    }
}

/**
 * Updates the error handling by removing the default handler and adding custom handlers for errors and unhandled promise rejections.
 */
function updateErrorHandling() {
  const errorHandler = (event: ErrorEvent) => {
    console.error(event.error);
    alertError(event.error);
  };
  const rejectHandler = (event: PromiseRejectionEvent) => {
    console.error(event.reason);
    alertError(event.reason);
  };
  window.addEventListener('error', errorHandler);
  window.addEventListener('unhandledrejection', rejectHandler);
}

/**
 * Registers the service worker and initializes it.
 * 
 * @returns {Promise<void>} - A promise that resolves when the service worker is registered and initialized.
 */
async function registerSw() {
    await navigator.serviceWorker.register("/sw.js", {
        scope: "/"
    });
    await sleep(100);
    const da = await fetch('/sw/init');
    if (!(da.status >= 200 && da.status < 300)) {
        location.reload();
    }
}

/**
 * Regular expression to match backslashes.
 * 
 * @constant {RegExp}
 */
const re = /\\/g;

/**
 * Gets the basename of a given path.
 * 
 * @param {string} data - The path to get the basename from.
 * @returns {string} - The basename of the path.
 */
function getBasename(data: string) {
    const splited = data.replace(re, '/').split('/');
    const lasts = splited[splited.length - 1];
    return lasts;
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
 * Checks and updates the database format to the latest version.
 * 
 * @returns {Promise<void>} - A promise that resolves when the database format check and update is complete.
 */
async function checkNewFormat(): Promise<void> {
    let db = getDatabase();

    // Check data integrity
    db.characters = db.characters.map((v) => {
        if (!v) {
            return null;
        }
        v.chaId ??= uuidv4();
        v.type ??= 'character';
        v.chatPage ??= 0;
        v.chats ??= [];
        v.customscript ??= [];
        v.firstMessage ??= '';
        v.globalLore ??= [];
        v.name ??= '';
        v.viewScreen ??= 'none';
        v.emotionImages = v.emotionImages ?? [];

        if (v.type === 'character') {
            v.bias ??= [];
            v.characterVersion ??= '';
            v.creator ??= '';
            v.desc ??= '';
            v.utilityBot ??= false;
            v.tags ??= [];
            v.systemPrompt ??= '';
            v.scenario ??= '';
        }
        return v;
    }).filter((v) => {
        return v !== null;
    });

    db.modules = (db.modules ?? []).map((v) => {
        if (v?.lorebook) {
            v.lorebook = updateLorebooks(v.lorebook);
        }
        return v
    }).filter((v) => {
        return v !== null && v !== undefined;
    });

    db.personas = (db.personas ?? []).map((v) => {
        v.id ??= uuidv4()
        return v
    }).filter((v) => {
        return v !== null && v !== undefined;
    });

    if(!db.formatversion){
        function checkParge(data:string){

            if(data.startsWith('assets') || (data.length < 3)){
                return data
            }
            else{
                const d = 'assets/' + (data.replace(/\\/g, '/').split('assets/')[1])
                if(!d){
                    return data
                }
                return d;
            }
        }

        db.customBackground = checkParge(db.customBackground);
        db.userIcon = checkParge(db.userIcon);

        for (let i = 0; i < db.characters.length; i++) {
            if (db.characters[i].image) {
                db.characters[i].image = checkParge(db.characters[i].image);
            }
            if (db.characters[i].emotionImages) {
                for (let i2 = 0; i2 < db.characters[i].emotionImages.length; i2++) {
                    if (db.characters[i].emotionImages[i2] && db.characters[i].emotionImages[i2].length >= 2) {
                        db.characters[i].emotionImages[i2][1] = checkParge(db.characters[i].emotionImages[i2][1]);
                    }
                }
            }
        }

        db.formatversion = 2;
    }
    if (db.formatversion < 3) {
        for (let i = 0; i < db.characters.length; i++) {
            let cha = db.characters[i];
            if (cha.type === 'character') {
                if (checkNullish(cha.sdData)) {
                    cha.sdData = defaultSdDataFunc();
                }
            }
        }

        db.formatversion = 3;
    }
    if (db.formatversion < 4) {
        //migration removed due to issues
        db.formatversion = 4;
    }
    if(db.formatversion < 5){
        if(db.loreBookToken < 8000){
            db.loreBookToken = 8000;
        }
        db.formatversion = 5;
    }
    if (!db.characterOrder) {
        db.characterOrder = [];
    }
    if (db.mainPrompt === oldMainPrompt) {
        db.mainPrompt = defaultMainPrompt;
    }
    if (db.mainPrompt === oldJailbreak) {
        db.mainPrompt = defaultJailbreak;
    }
    for (let i = 0; i < db.characters.length; i++) {
        const trashTime = db.characters[i].trashTime;
        const targetTrashTime = trashTime ? trashTime + 1000 * 60 * 60 * 24 * 3 : 0;
        if (trashTime && targetTrashTime < Date.now()) {
            db.characters.splice(i, 1);
            i--;
        }
    }
    setDatabase(db);
    checkCharOrder();
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
 * Purges chunks of data that are not needed.
 * Removes files from the assets directory that are not in the list of unpargeable items.
 * Both Tauri and web use IndexedDB (forageStorage) for asset storage now.
 */
async function pargeChunks(){
    const db = getDatabase()
    if(db.account?.useSync){
        return
    }

    const unpargeable = new Set(getUnpargeables(db))
    const indexes = await forageStorage.keys()
    for(const asset of indexes){
        if(!asset.startsWith('assets/')){
            continue
        }
        const n = getBasename(asset)
        if(!unpargeable.has(n)){
            await forageStorage.removeItem(asset)
        }
    }
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

//Assigns unique IDs to chara and chat
function assignIds(){
    if(!DBState?.db?.characters){
        return
    }
    const assignedIds = new Set<string>()
    for(let i=0;i<DBState.db.characters.length;i++){
        const cha = DBState.db.characters[i]
        if(!cha.chaId){
            cha.chaId = uuidv4()
        }
        if(assignedIds.has(cha.chaId)){
            console.warn(`Duplicate chaId found: ${cha.chaId}. Assigning new ID.`);
            cha.chaId = uuidv4();
        }
        assignedIds.add(cha.chaId)
        for(let i2=0;i2<cha.chats.length;i2++){
            const chat = cha.chats[i2]
            if(!chat.id){
                chat.id = uuidv4()
            }
            if(assignedIds.has(chat.id)){
                console.warn(`Duplicate chat ID found: ${chat.id}. Assigning new ID.`);
                chat.id = uuidv4();
            }
            assignedIds.add(chat.id)
        }
    }

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
 * A writer class for mobile environment.
 */
class MobileWriter{
    path: string
    firstWrite: boolean = true

    /**
     * Creates an instance of MobileWriter.
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
        if(this.firstWrite){
            if(!await CapFS.Filesystem.checkPermissions()){
                await CapFS.Filesystem.requestPermissions()
            }
            await CapFS.Filesystem.writeFile({
                path: this.path,
                data: Buffer.from(data).toString('base64'),
                recursive: true,
                directory: CapFS.Directory.Documents
            })
        }
        else{
            await CapFS.Filesystem.appendFile({
                path: this.path,
                data: Buffer.from(data).toString('base64'),
                directory: CapFS.Directory.Documents
            })
        }
        
        this.firstWrite = false
    }

    /**
     * Closes the writer. (No operation for MobileWriter)
     */
    async close(){
        // do nothing
    }
}


/**
 * Class representing a local writer.
 */
export class LocalWriter {
    writer: WritableStreamDefaultWriter | TauriWriter | MobileWriter

    /**
     * Initializes the writer.
     * 
     * @param {string} [name='Binary'] - The name of the file.
     * @param {string[]} [ext=['bin']] - The file extensions.
     * @returns {Promise<boolean>} - A promise that resolves to a boolean indicating success.
     */
    async init(name = 'Binary', ext = ['bin']): Promise<boolean> {
        if (isTauri) {
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
        if (Capacitor.isNativePlatform()) {
            this.writer = new MobileWriter(name + '.' + ext[0])
            return true
        }
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
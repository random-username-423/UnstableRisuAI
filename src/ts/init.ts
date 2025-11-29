/**
 * App initialization module
 * Contains loadData() and related startup functions
 */

import { get } from "svelte/store";
import { BaseDirectory, readFile, exists } from "@tauri-apps/plugin-fs";
import { isMobileTauri } from "src/ts/env";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { v4 as uuidv4 } from 'uuid';

import {
    forageStorage,
    initOPFSWorker,
    loadFromWorker,
    saveToWorker,
    listFromWorker,
    deleteFromWorker,
    getUnpargeables,
    saveDb,
    updateHeightMode,
    checkCharOrder
} from "./globalApi.svelte";
import { isTauri, isNodeServer } from "src/ts/env";
import { setDatabase, getDatabase, defaultSdDataFunc } from "./storage/database.svelte";
import { MobileGUI, botMakerMode, selectedCharID, loadedStore, DBState, LoadingStatusState } from "./stores.svelte";
import { checkNullish, changeFullscreen, sleep, getBasename } from "./util";
import { decodeRisuSave, encodeRisuSaveLegacy } from "./storage/risuSave";
import { migrateOPFSAssetsToIndexedDB, migrateTauriFsAssetsToIndexedDB, migrateWebDBtoOPFS } from './storage/migration';
import { checkRisuUpdate } from "./update";
import { loadPlugins } from "./plugins/plugins";
import { alertError, alertMd, alertTOS, waitAlert } from "./alert";
import { checkDriverInit } from "./drive/drive";
import { characterURLImport } from "./character/characterCards";
import { loadRisuAccountData } from "./drive/accounter";
import { autoServerBackup } from "./kei/backup";
import { updateAnimationSpeed } from "./gui/animation";
import { updateColorScheme, updateTextThemeAndCSS } from "./gui/colorscheme";
import { updateGuisize } from "./gui/guisize";
import { startObserveDom } from "./observer.svelte";
import { initMobileGesture } from "./hotkey/hotkey";
import { moduleUpdate } from "./process/modules";
import { makeColdData } from "./process/coldstorage.svelte";
import { language } from "src/lang";
import type { AccountStorage } from "./storage/accountStorage";
import { updateLorebooks } from "./character/characters";
import { defaultJailbreak, defaultMainPrompt, oldJailbreak, oldMainPrompt } from "./storage/defaultPrompts";

const appWindow = isTauri ? getCurrentWebviewWindow() : null

/**
 * Gets database backup timestamps from OPFS, cleaning up old backups.
 */
export async function getDbBackups() {
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


/**
 * Loads the application data.
 * Called once at app startup from main.ts.
 */
export async function loadData() {
    const loaded = get(loadedStore)
    if(!loaded){
        try {
            if(isTauri){
                LoadingStatusState.text = "Checking Files..."

                if(!isMobileTauri){
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
                if(navigator.serviceWorker){
                    await registerSw()
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
            if(db.betaMobileGUI && window.innerWidth <= 800){
                initMobileGesture()
                MobileGUI.set(true)
            }
            loadedStore.set(true)
            selectedCharID.set(-1)
            startObserveDom()
            ensureValidIds()
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
 * Registers the service worker for PWA functionality.
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
 * Assigns unique IDs to characters and chats.
 */
function ensureValidIds(){
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
 * Cleans up unused asset files from storage.
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
 * Sets up global error handlers.
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
 * Checks and migrates database format to the latest version.
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
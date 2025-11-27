import { alertError, alertInput, alertNormal, alertSelect, alertStore } from "../alert";
import { getDatabase, type Database } from "../storage/database.svelte";
import { forageStorage, getUnpargeables, isTauri, openURL, saveToWorker, listFromWorker, loadFromWorker } from "../globalApi.svelte";
import { BaseDirectory, exists, readFile, readDir } from "@tauri-apps/plugin-fs";
import { language } from "../../lang";
import { relaunch } from '@tauri-apps/plugin-process';
import { sleep } from "../util";
import { decodeRisuSave, encodeRisuSaveLegacy } from "../storage/risuSave";

export async function checkDriver(type:'save'|'load'|'loadtauri'|'savetauri'|'reftoken'){
    const CLIENT_ID = '580075990041-l26k2d3c0nemmqiu3d3aag01npfrkn76.apps.googleusercontent.com';
    const REDIRECT_URI = type === 'reftoken' ? 'https://sv.risuai.xyz/drive' : "https://risuai.xyz/"
    const SCOPE = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata';
    const encodedRedirectUri = encodeURIComponent(REDIRECT_URI);
    const authorizationUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodedRedirectUri}&scope=${SCOPE}&response_type=code&state=${type}`;
    

    if(type === 'reftoken'){
        const authorizationUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodedRedirectUri}&scope=${SCOPE}&response_type=code&state=${"accesstauri"}&access_type=offline&prompt=consent`;
        return authorizationUrl
    }

    if(type === 'save' || type === 'load'){
        location.href = (authorizationUrl);
    }
    else{
        
        try {
            if(isTauri){
                openURL(authorizationUrl)
            }
            else{
                window.open(authorizationUrl)
            }
            let code = await alertInput(language.pasteAuthCode)
            if(code.includes(' ')){
                code = code.substring(code.lastIndexOf(' ')).trim()
            }
            if(type === 'loadtauri'){
                await loadDrive(code, 'backup')
            }
            else{
                await backupDrive(code)
            }
        } catch (error) {
            console.error(error)
            alertError(`Backup Error: ${error}`)
        }
    }
}


export async function checkDriverInit() {
    try {
        const loc = new URLSearchParams(location.search)
        const code = loc.get('code')
    
        if(code){
            const res = await fetch(`/drive?code=${encodeURIComponent(code)}`)
            if(res.status >= 200 && res.status < 300){
                const json:{
                    access_token:string,
                    expires_in:number
                } = await res.json()
                const da = loc.get('state')
                if(da === 'save'){
                    await backupDrive(json.access_token)
                }
                else if(da === 'load'){
                    await loadDrive(json.access_token, 'backup')
                }
                else if(da === 'savetauri' || da === 'loadtauri'){
                    alertStore.set({
                        type: 'wait2',
                        msg: `Copy and paste this Auth Code: ${json.access_token}`
                    })
                }
                else if(da === 'accesstauri'){
                    alertStore.set({
                        type: 'wait2',
                        msg: JSON.stringify(json)
                    })
                }
            }
            else{
                alertError(await res.text())
                location.search = ''
            }
            return true
        }
        else{
            return false
        }   
    } catch (error) {
        console.error(error)
        alertError(`Backup Error: ${error}`)
        const currentURL = new URL(location.href)
        currentURL.search = ''
        window.history.replaceState( {} , "", currentURL.href );
        await sleep(100000)
        return false
    }
}

let lastSaved:number = parseInt(localStorage.getItem('risu_lastsaved') ?? '-1')
let BackupDb:Database = null


export async function syncDrive() {
    BackupDb = safeStructuredClone(getDatabase())
    return
}


async function backupDrive(ACCESS_TOKEN:string) {
    alertStore.set({
        type: "wait",
        msg: "Uploading Backup... (Fetching file list)"
    })
    await sleep(10)  // UI 업데이트 대기

    console.log('[GoogleDrive Backup] Starting backup...')
    const files:DriveFile[] = await getFilesInFolder(ACCESS_TOKEN)
    console.log(`[GoogleDrive Backup] Found ${files.length} existing files in Drive`)

    const fileNames = files.map((d) => {
        return d.name
    })

    const PARALLEL_UPLOADS = getDatabase().driveParallelConnections || 20

    if(isTauri){
        // OPFS와 Tauri fs 모두에서 에셋 수집
        const allAssets = new Set<string>()

        // 1. OPFS에서 에셋 목록 가져오기
        const opfsAssets = await listFromWorker('assets')
        for (const name of opfsAssets) {
            if (name.endsWith('.png')) {
                allAssets.add(name)
            }
        }

        // 2. Tauri fs에서도 에셋 목록 가져오기 (마이그레이션 전 데이터용)
        try {
            const tauriAssets = await readDir('assets', {baseDir: BaseDirectory.AppData})
            for (const asset of tauriAssets) {
                if (asset.name && asset.name.endsWith('.png')) {
                    allAssets.add(asset.name)
                }
            }
        } catch {
            // assets 폴더가 없을 수 있음
        }

        const assetList = Array.from(allAssets)
        console.log(`[GoogleDrive Backup] Tauri: Found ${assetList.length} local assets (OPFS: ${opfsAssets.length})`)

        // 업로드할 파일 목록 수집
        const toUpload: { assetName: string, formatedKey: string }[] = []
        let skippedCount = 0
        for (const assetName of assetList) {
            if (!assetName.endsWith('.png')) continue
            const formatedKey = newFormatKeys(assetName)
            if (!fileNames.includes(formatedKey)) {
                toUpload.push({ assetName, formatedKey })
            } else {
                skippedCount++
            }
        }

        console.log(`[GoogleDrive Backup] Tauri: ${toUpload.length} to upload, ${skippedCount} skipped (already exists)`)

        // 슬라이딩 윈도우 병렬 업로드
        let uploadedCount = 0
        let currentIndex = 0

        async function uploadOne(): Promise<void> {
            if (currentIndex >= toUpload.length) return

            const { assetName, formatedKey } = toUpload[currentIndex++]

            // OPFS에서 먼저 시도
            let data = await loadFromWorker('assets/' + assetName)

            // OPFS에 없으면 Tauri fs에서 시도
            if (!data) {
                try {
                    data = await readFile('assets/' + assetName, {baseDir: BaseDirectory.AppData})
                } catch {
                    console.log(`[GoogleDrive Backup] Failed to load asset: ${assetName}`)
                    await uploadOne()
                    return
                }
            }

            await createFileInFolder(ACCESS_TOKEN, formatedKey, data)
            uploadedCount++

            alertStore.set({
                type: "wait",
                msg: `Uploading Backup... (${uploadedCount} / ${toUpload.length})`
            })

            await uploadOne()
        }

        // 동시에 PARALLEL_UPLOADS개 시작
        await Promise.all(
            Array.from({ length: Math.min(PARALLEL_UPLOADS, toUpload.length) }, () => uploadOne())
        )

        console.log(`[GoogleDrive Backup] Tauri: Uploaded ${uploadedCount}`)
    }
    else{
        const keys = await forageStorage.keys()
        console.log(`[GoogleDrive Backup] Web: Found ${keys.length} local keys`)

        // 업로드할 파일 목록 수집
        const toUpload: { key: string, formatedKey: string }[] = []
        let skippedCount = 0
        for (const key of keys) {
            if (!key.endsWith('.png')) continue
            const formatedKey = newFormatKeys(key)
            if (!fileNames.includes(formatedKey)) {
                toUpload.push({ key, formatedKey })
            } else {
                skippedCount++
            }
        }

        console.log(`[GoogleDrive Backup] Web: ${toUpload.length} to upload, ${skippedCount} skipped (already exists)`)

        // 슬라이딩 윈도우 병렬 업로드
        let uploadedCount = 0
        let currentIndex = 0

        async function uploadOne(): Promise<void> {
            if (currentIndex >= toUpload.length) return

            const { key, formatedKey } = toUpload[currentIndex++]
            const data = await forageStorage.getItem(key) as unknown as Uint8Array

            if (data) {
                await createFileInFolder(ACCESS_TOKEN, formatedKey, data)
                uploadedCount++

                alertStore.set({
                    type: "wait",
                    msg: `Uploading Backup... (${uploadedCount} / ${toUpload.length})`
                })
            }

            await uploadOne()
        }

        // 동시에 PARALLEL_UPLOADS개 시작
        await Promise.all(
            Array.from({ length: Math.min(PARALLEL_UPLOADS, toUpload.length) }, () => uploadOne())
        )

        console.log(`[GoogleDrive Backup] Web: Uploaded ${uploadedCount}`)
    }

    const dbData = encodeRisuSaveLegacy(getDatabase(), 'compression')

    alertStore.set({
        type: "wait",
        msg: `Uploading Backup... (Saving database)`
    })

    const dbFileName = `${(Date.now() / 1000).toFixed(0)}-database.risudat`
    await createFileInFolder(ACCESS_TOKEN, dbFileName, dbData)
    console.log(`[GoogleDrive Backup] Database saved as: ${dbFileName} (${(dbData.byteLength / 1024 / 1024).toFixed(2)} MB)`)
    console.log('[GoogleDrive Backup] Backup completed successfully!')

    alertNormal('Success')
}

type DriveFile = {
    mimeType:string
    name:string
    id: string
}

async function loadDrive(ACCESS_TOKEN:string, mode: 'backup'|'sync'):Promise<void|"noSync"> {
    if(mode === 'backup'){
        alertStore.set({
            type: "wait",
            msg: "Loading Backup... (Fetching file list)"
        })
        await sleep(10)  // UI 업데이트 대기
    }
    console.log(`[GoogleDrive Restore] Starting restore (mode: ${mode})...`)
    const files:DriveFile[] = await getFilesInFolder(ACCESS_TOKEN)
    console.log(`[GoogleDrive Restore] Found ${files.length} files in Drive`)
    let foragekeys:string[] = []
    let loadedForageKeys = false
    let opfsAssetKeys: string[] = []
    let loadedOpfsKeys = false
    let db = getDatabase()

    async function checkImageExists(images:string) {
        if(db?.account?.useSync){
            return false
        }
        if(isTauri){
            // OPFS 파일 목록 캐싱 (세션 45 이후 에셋은 OPFS에 저장됨)
            if (!loadedOpfsKeys) {
                opfsAssetKeys = await listFromWorker('assets')
                loadedOpfsKeys = true
            }

            // OPFS에서 확인
            if (opfsAssetKeys.includes(images)) return true

            // OPFS에 없으면 Tauri fs 확인 (마이그레이션 전 데이터용)
            return await exists(`assets/` + images, {baseDir: BaseDirectory.AppData})
        }
        else{
            if(!loadedForageKeys){
                foragekeys = await forageStorage.keys()
                loadedForageKeys = true
            }
            return foragekeys.includes('assets/' + images)
        }
    }
    const fileNames = files.map((d) => {
        return d.name
    })


    let dbs:[DriveFile,number][] = []
    let noSyncData = true

    if(mode === 'backup'){
        for(const f of files){
            if(f.name.endsWith("-database.risudat")){
                const tm = parseInt(f.name.split('-')[0])
                if(isNaN(tm)){
                    continue
                }
                else{
                    dbs.push([f,tm])
                }
            }
        }
        dbs.sort((a,b) => {
            return b[1] - a[1]
        })
    }
    else if(mode === 'sync'){
        for(const f of files){
            if(f.name.endsWith("-database.risudat2")){
                const tm = parseInt(f.name.split('-')[0])
                if(isNaN(tm)){
                    continue
                }
                else{
                    if(tm > lastSaved){
                        dbs.push([f,tm])
                    }
                    noSyncData = false
                }
            }
        }
        dbs.sort((a,b) => {
            return b[1] - a[1]
        })
    }

    if(noSyncData && mode === 'sync'){
        return 'noSync'
    }

    if(dbs.length !== 0){
        if(mode === 'sync'){
            alertStore.set({
                type: "wait",
                msg: "Sync Data..."
            })
        }
        async function getDbFromList(){
            let selectables:string[] = []
            for(let i=0;i<dbs.length;i++){
                selectables.push(`Backup saved in ${(new Date(dbs[i][1] * 1000)).toLocaleString()}`)
                if(selectables.length > 7){
                    break
                }
            }
            const selectedIndex = (await alertSelect([language.loadLatest, language.loadOthers]) === '0') ? 0 : parseInt(await alertSelect(selectables))
            const selectedDb = dbs[selectedIndex][0]

            alertStore.set({
                type: "wait",
                msg: "Loading Backup... (Downloading database)"
            })
            await sleep(10)

            const decompressedDb:Database = await decodeRisuSave(await getFileData(ACCESS_TOKEN, selectedDb.id))
            return decompressedDb
        }
    
        const db:Database = mode === 'backup' ? await getDbFromList() : JSON.parse(Buffer.from(await getFileData(ACCESS_TOKEN, dbs[0][0].id)).toString('utf-8'))
        lastSaved = Date.now()
        localStorage.setItem('risu_lastsaved', `${lastSaved}`)
        const requiredImages = (getUnpargeables(db))
        console.log(`[GoogleDrive Restore] Database loaded. Required assets: ${requiredImages.length}`)

        // Log sample of Drive files for debugging
        const sampleFiles = fileNames.slice(0, 10)
        console.log(`[GoogleDrive Restore] Sample of Drive files (first 10):`, sampleFiles)

        const PARALLEL_DOWNLOADS = getDatabase().driveParallelConnections || 20
        let errorLogs:string[] = []
        let downloadedCount = 0
        let skippedCount = 0
        let notFoundCount = 0
        let processedCount = 0

        // 다운로드할 파일 목록 수집 (로컬에 없는 것만)
        const toDownload: { images: string, fileId: string | null }[] = []
        for (const images of requiredImages) {
            if (await checkImageExists(images)) {
                skippedCount++
                continue
            }

            // Drive에서 파일 찾기 (newFormatKeys, formatKeys 순서로 시도)
            let fileId: string | null = null
            const newFormat = newFormatKeys(images)
            const oldFormat = formatKeys(images)

            if (fileNames.includes(newFormat)) {
                const file = files.find(f => f.name === newFormat)
                if (file) fileId = file.id
            } else if (fileNames.includes(oldFormat)) {
                const file = files.find(f => f.name === oldFormat)
                if (file) fileId = file.id
            }

            if (fileId) {
                toDownload.push({ images, fileId })
            } else {
                // 파일을 찾지 못함
                if (errorLogs.length < 20) {
                    errorLogs.push(`Asset not found: "${images}" (searched as: "${newFormat}" and "${oldFormat}")`)
                }
                notFoundCount++
            }
        }

        console.log(`[GoogleDrive Restore] ${toDownload.length} to download, ${skippedCount} skipped, ${notFoundCount} not found`)

        // 슬라이딩 윈도우 병렬 다운로드
        let currentIndex = 0

        async function downloadOne(): Promise<void> {
            if (currentIndex >= toDownload.length) return

            const { images, fileId } = toDownload[currentIndex++]

            try {
                const fData = await getFileData(ACCESS_TOKEN, fileId!)
                if (isTauri) {
                    await saveToWorker('assets/' + images, fData)
                } else {
                    await forageStorage.setItem('assets/' + images, fData)
                }
                downloadedCount++
            } catch (e) {
                console.log(`[GoogleDrive Restore] Failed to download: ${images}`, e)
            }

            processedCount++
            alertStore.set({
                type: "wait",
                msg: mode === 'sync'
                    ? `Sync Files... (${processedCount} / ${toDownload.length})`
                    : `Loading Backup... (${processedCount} / ${toDownload.length})`
            })

            await downloadOne()
        }

        // 동시에 PARALLEL_DOWNLOADS개 시작
        if (toDownload.length > 0) {
            await Promise.all(
                Array.from({ length: Math.min(PARALLEL_DOWNLOADS, toDownload.length) }, () => downloadOne())
            )
        }

        console.log(`[GoogleDrive Restore] Restore summary:`)
        console.log(`  - Downloaded: ${downloadedCount}`)
        console.log(`  - Skipped (already exists): ${skippedCount}`)
        console.log(`  - Not found in Drive: ${notFoundCount}`)
        if(errorLogs.length > 0){
            console.log(`[GoogleDrive Restore] Not found assets (first ${errorLogs.length}):`)
            errorLogs.forEach(e => console.log(`  ${e}`))
        }
        db.didFirstSetup = true
        const dbData = encodeRisuSaveLegacy(db, 'compression')
        console.log(`[GoogleDrive Restore] Saving database... (${(dbData.byteLength / 1024 / 1024).toFixed(2)} MB)`)

        if(isTauri){
            await saveToWorker('database/database.bin', dbData)
            console.log('[GoogleDrive Restore] Restore completed! Relaunching app...')
            relaunch()
            alertStore.set({
                type: "wait",
                msg: "Success, Refreshing your app."
            })
        }
        else{
            await forageStorage.setItem('database/database.bin', dbData)
            console.log('[GoogleDrive Restore] Restore completed! Refreshing page...')
            location.search = ''
            alertStore.set({
                type: "wait",
                msg: "Success, Refreshing your app."
            })
        }
    }
    else if(mode === 'backup'){
        location.search = ''
    }
}

function checkImageExist(image:string){

}


function formatKeys(name:string) {
    return getBasename(name).replace(/\_/g, '__').replace(/\./g,'_d').replace(/\//,'_s') + '.png'
}

function newFormatKeys(name:string) {
    let n = getBasename(name)
    const bf = Buffer.from(n).toString('hex')
    return n + '.bin'
}

async function getFilesInFolder(ACCESS_TOKEN:string, nextPageToken=''): Promise<DriveFile[]> {
    const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&pageSize=300` + nextPageToken;
    
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
        },
    });
    
    if (response.ok) {
        const data = await response.json();
        if(data.nextPageToken){
            return (data.files as DriveFile[]).concat(await getFilesInFolder(ACCESS_TOKEN, `&pageToken=${data.nextPageToken}`))
        }
        return data.files as DriveFile[];
    } else {
        throw(`Error: ${response.status}`);
    }
}

async function createFileInFolder(accessToken:string, fileName:string, content:Uint8Array, mimeType = 'application/octet-stream') {
    const metadata = {
      name: fileName,
      mimeType: mimeType,
      parents: ["appDataFolder"],
    };
  
    const body = new FormData();
    body.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" })
    );
    body.append("file", new Blob([content as BlobPart], { type: mimeType }));
  
    const response = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: body,
      }
    );
  
    const result = await response.json();
  
    if (response.ok) {
      return result;
    } else {
      console.error("Error creating file:", result);
      throw new Error(result.error.message);
    }
}
  
const baseNameRegex = /\\/g
function getBasename(data:string){
    const splited = data.replace(baseNameRegex, '/').split('/')
    const lasts = splited[splited.length-1]
    return lasts
}

async function getFileData(ACCESS_TOKEN:string,fileId:string) {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  
    const request = {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`
      }
    };
  
    const response = await fetch(url, request);
  
    if (response.ok) {
      const data = new Uint8Array(await response.arrayBuffer());
      return data;
    } else {
        throw "Error in response when reading files in folder"
    }
  }
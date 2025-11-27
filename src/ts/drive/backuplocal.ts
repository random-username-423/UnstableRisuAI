import { BaseDirectory, readFile, readDir } from "@tauri-apps/plugin-fs";
import { alertError, alertNormal, alertStore, alertWait, alertMd, waitAlert } from "../alert";
import { LocalWriter, forageStorage, isTauri, requiresFullEncoderReload, saveToWorker, listFromWorker, loadFromWorker } from "../globalApi.svelte";
import { decodeRisuSave, encodeRisuSaveLegacy } from "../storage/risuSave";
import { getDatabase, setDatabaseLite } from "../storage/database.svelte";
import { relaunch } from "@tauri-apps/plugin-process";
import { platform } from "@tauri-apps/plugin-os";
import { sleep } from "../util";

function getBasename(data:string){
    const baseNameRegex = /\\/g
    const splited = data.replace(baseNameRegex, '/').split('/')
    const lasts = splited[splited.length-1]
    return lasts
}

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
        let i = 0;
        for(let assetName of assetList){
            i += 1;
            let message = `Saving local Backup... (${i} / ${assetList.length})`
            if (missingAssets.length > 0) {
                const skippedItems = missingAssets.map(key => {
                    const assetInfo = assetMap.get(key);
                    return assetInfo ? `'${assetInfo.assetName}' from ${assetInfo.charName}` : `'${key}'`;
                }).join(', ');
                message += `\n(Skipping... ${skippedItems})`;
            }
            alertWait(message)

            // OPFS에서 먼저 시도
            let data = await loadFromWorker('assets/' + assetName)

            // OPFS에 없으면 Tauri fs에서 시도
            if (!data) {
                try {
                    data = await readFile('assets/' + assetName, {baseDir: BaseDirectory.AppData})
                } catch {
                    // 파일 없음
                }
            }

            if (data) {
                await writer.writeBackup(assetName, data)
            } else {
                missingAssets.push(assetName)
            }
        }
    }
    else{
        const keys = await forageStorage.keys()

        for(let i=0;i<keys.length;i++){
            const key = keys[i]
            let message = `Saving local Backup... (${i + 1} / ${keys.length})`
            if (missingAssets.length > 0) {
                const skippedItems = missingAssets.map(key => {
                    const assetInfo = assetMap.get(key);
                    return assetInfo ? `'${assetInfo.assetName}' from ${assetInfo.charName}` : `'${key}'`;
                }).join(', ');
                message += `\n(Skipping... ${skippedItems})`;
            }
            alertWait(message)

            if(!key || !key.endsWith('.png')){
                continue
            }
            const data = await forageStorage.getItem(key) as unknown as Uint8Array
            if (data) {
                await writer.writeBackup(key, data)
            } else {
                missingAssets.push(key)
            }
            if(forageStorage.isAccount){
                await sleep(1000)
            }
        }
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

export async function LoadLocalBackup(){
    try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.bin';
        input.onchange = async () => {
            if (!input.files || input.files.length === 0) {
                input.remove();
                return;
            }
            const file = input.files[0];
            input.remove();

            try {
                const reader = file.stream().getReader();
                const CHUNK_SIZE = 1024 * 1024; // 1MB chunk size
                let bytesRead = 0;
                let remainingBuffer = new Uint8Array();

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        break;
                    }

                    bytesRead += value.length;
                    const progress = ((bytesRead / file.size) * 100).toFixed(2);
                    alertWait(`Loading local Backup... (${progress}%)`);

                    const newBuffer = new Uint8Array(remainingBuffer.length + value.length);
                    newBuffer.set(remainingBuffer);
                    newBuffer.set(value, remainingBuffer.length);
                    remainingBuffer = newBuffer;

                    let offset = 0;
                    while (offset + 4 <= remainingBuffer.length) {
                        const nameLength = new Uint32Array(remainingBuffer.slice(offset, offset + 4).buffer)[0];

                        if (offset + 4 + nameLength > remainingBuffer.length) {
                            break;
                        }
                        const nameBuffer = remainingBuffer.slice(offset + 4, offset + 4 + nameLength);
                        const name = new TextDecoder().decode(nameBuffer);

                        if (offset + 4 + nameLength + 4 > remainingBuffer.length) {
                            break;
                        }
                        const dataLength = new Uint32Array(remainingBuffer.slice(offset + 4 + nameLength, offset + 4 + nameLength + 4).buffer)[0];

                        if (offset + 4 + nameLength + 4 + dataLength > remainingBuffer.length) {
                            break;
                        }
                        const data = remainingBuffer.slice(offset + 4 + nameLength + 4, offset + 4 + nameLength + 4 + dataLength);

                        if (name === 'database.risudat') {
                            const db = new Uint8Array(data);
                            const dbData = await decodeRisuSave(db);
                            setDatabaseLite(dbData);
                            requiresFullEncoderReload.state = true;
                            if (isTauri) {
                                await saveToWorker('database/database.bin', db);
                                const currentPlatform = await platform();
                                if (currentPlatform === 'android' || currentPlatform === 'ios') {
                                    location.reload();
                                } else {
                                    await relaunch();
                                }
                                alertStore.set({
                                    type: "wait",
                                    msg: "Success, Refreshing your app."
                                });
                            } else {
                                await forageStorage.setItem('database/database.bin', db);
                                location.search = '';
                                alertStore.set({
                                    type: "wait",
                                    msg: "Success, Refreshing your app."
                                });
                            }
                        } else {
                            if (isTauri) {
                                await saveToWorker('assets/' + name, data);
                            } else {
                                await forageStorage.setItem('assets/' + name, data);
                            }
                        }
                        await sleep(10);
                        if (forageStorage.isAccount) {
                            await sleep(1000);
                        }

                        offset += 4 + nameLength + 4 + dataLength;
                    }
                    remainingBuffer = remainingBuffer.slice(offset);
                }

                alertNormal('Success');
            } catch (error) {
                console.error('[LoadLocalBackup] Error:', error);
                alertError(`Failed to load backup: ${error?.message || error}`);
            }
        };

        input.click();
    } catch (error) {
        console.error(error);
        alertError('Failed, Is file corrupted?')
    }
}
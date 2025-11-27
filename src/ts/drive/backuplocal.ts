// Note: BaseDirectory, readFile, readDir are no longer needed for backup since assets now use IndexedDB
import { alertError, alertNormal, alertStore, alertWait, alertMd, waitAlert, alertClear } from "../alert";
import { LocalWriter, forageStorage, isTauri, requiresFullEncoderReload, saveToWorker } from "../globalApi.svelte";
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

    // IndexedDB (forageStorage)에서 에셋 수집 (Tauri와 웹 모두 동일)
    const keys = await forageStorage.keys()
    const assetKeys = keys.filter(key => key && key.endsWith('.png'))

    for(let i = 0; i < assetKeys.length; i++){
        const key = assetKeys[i]
        let message = `Saving local Backup... (${i + 1} / ${assetKeys.length})`
        if (missingAssets.length > 0) {
            const skippedItems = missingAssets.map(k => {
                const assetInfo = assetMap.get(k);
                return assetInfo ? `'${assetInfo.assetName}' from ${assetInfo.charName}` : `'${k}'`;
            }).join(', ');
            message += `\n(Skipping... ${skippedItems})`;
        }
        alertWait(message)

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
                            console.log('[LoadLocalBackup] Found database.risudat, processing...');
                            const db = new Uint8Array(data);
                            const dbData = await decodeRisuSave(db);
                            console.log('[LoadLocalBackup] Database decoded');
                            setDatabaseLite(dbData);
                            requiresFullEncoderReload.state = true;
                            if (isTauri) {
                                await saveToWorker('database/database.bin', db);
                                console.log('[LoadLocalBackup] Saved to worker');
                                const currentPlatform = await platform();
                                console.log('[LoadLocalBackup] Platform:', currentPlatform);
                                alertClear();
                                await sleep(50);
                                if (currentPlatform === 'android' || currentPlatform === 'ios') {
                                    // Mobile: Ask user to manually restart (process plugin not supported)
                                    alertNormal('Backup loaded successfully!\nPlease close and reopen the app.');
                                    return;
                                } else {
                                    await relaunch();
                                }
                            } else {
                                await forageStorage.setItem('database/database.bin', db);
                                alertClear();
                                await sleep(50);
                                location.search = '';
                            }
                            return;
                        } else {
                            // 에셋은 IndexedDB (forageStorage)에 저장 (Tauri와 웹 모두 동일)
                            await forageStorage.setItem('assets/' + name, data);
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
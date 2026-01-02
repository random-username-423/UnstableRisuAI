import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getDatabase } from "../storage/database.svelte";
import { isTauri } from "../platform";

const appWindow = isTauri ? getCurrentWebviewWindow() : null

export async function changeFullscreen(){
    const db = getDatabase()
    const isFull = await appWindow.isFullscreen()
    if(db.fullScreen && (!isFull)){
        await appWindow.setFullscreen(true)
    }
    if((!db.fullScreen) && (isFull)){
        await appWindow.setFullscreen(false)
    }
}

export function maximizeWindow(){
    appWindow?.maximize()
}

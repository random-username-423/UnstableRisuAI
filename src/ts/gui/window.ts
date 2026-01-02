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

/**
 * Toggles the fullscreen mode of the document.
 * If the document is currently in fullscreen mode, it exits fullscreen.
 * If the document is not in fullscreen mode, it requests fullscreen with navigation UI hidden.
 */
export function toggleFullscreen() {
    const fullscreenElement = document.fullscreenElement
    if (fullscreenElement) {
        void document.exitFullscreen()
    } else {
        void document.documentElement.requestFullscreen({
            navigationUI: "hide"
        })
    }
}

import { alertConfirm, alertWait } from "./alert";
import { language } from "../lang";
import { platform } from '@tauri-apps/plugin-os';
import { relaunch } from '@tauri-apps/plugin-process';

export async function checkRisuUpdate(){
    const currentPlatform = await platform();
    const isMobile = currentPlatform === 'android' || currentPlatform === 'ios';
    
    if(isMobile){
        return;
    }

    try {
        // 동적 import로 변경 (모바일에서는 여기까지 안 옴)
        const { check } = await import('@tauri-apps/plugin-updater');
        
        const checked = await check();     
        if(checked){
            const conf = await alertConfirm(language.newVersion);
            if(conf){
                alertWait(`Updating to ${checked.version}...`);
                await checked.downloadAndInstall();
                await relaunch();
            }
        }
    } catch (error) {
        console.error(error);
    }
}

function versionStringToNumber(versionString:string):number {
    return Number(
      versionString
        .split(".")
        .map((component) => component.padStart(4, "0"))
        .join("")
    );
}
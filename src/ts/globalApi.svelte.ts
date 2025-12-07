import { DBState } from "./stores.svelte";

// Re-export for backwards compatibility
export { loadChat, saveChat } from "./data/storage/chatStorage";
export { saving, requiresFullEncoderReload, saveDb } from "./data/storage/autoSaveManager.svelte";

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

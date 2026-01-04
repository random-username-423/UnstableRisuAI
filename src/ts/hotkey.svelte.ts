import { get } from "svelte/store"
import { alertClear, alertMd, alertSelect, alertWait, doingAlert, alertRequestLogs } from "./alert"
import { getDatabase  } from "./storage/database.svelte"
import { changeToPreset as changeToPreset2 } from './storage/preset-manager'
import { alertStore, layoutState, modalState, realmState, PlaygroundStore, QuickSettings, SafeModeStore, selectedCharID, settingsOpen } from "./stores.svelte"
import { language } from "src/lang"
import { updateTextThemeAndCSS } from "./gui/colorscheme"
import { defaultHotkeys } from "./defaulthotkeys"
import { doingChat, previewBody, sendChat } from "./process/index.svelte"
import { addToast } from "./toast.svelte"

export function initHotkey(){
    document.addEventListener('keydown', async (ev) => {
        console.log(document.activeElement)
        if(
            !ev.ctrlKey &&
            !ev.altKey &&
            !ev.shiftKey &&
            (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) ||
            document.activeElement.getAttribute('contenteditable'))
        ){
            return
        }


        const database = getDatabase()

        const hotKeys = database?.hotkeys ?? defaultHotkeys

        let hotkeyRan = false
        for(const hotkey of hotKeys){
            let hotKeyRanThisTime = true
            
            
            hotkey.ctrl = hotkey.ctrl ?? false
            hotkey.alt = hotkey.alt ?? false
            hotkey.shift = hotkey.shift ?? false

            if(hotkey.key === ev.key){
             
                console.log(`Hotkey: "${hotkey.key}" ${hotkey.ctrl} ${hotkey.alt} ${hotkey.shift}`)
                console.log(`Event: "${ev.key}" ${ev.ctrlKey} ${ev.altKey} ${ev.shiftKey}`)
                
            }
            if(hotkey.ctrl !== ev.ctrlKey){
                continue
            }
            if(hotkey.alt !== ev.altKey){
                continue
            }
            if(hotkey.shift !== ev.shiftKey){
                continue
            }
            if(hotkey.key !== ev.key){
                continue
            }
            if(!hotkey.ctrl && !hotkey.alt && !hotkey.shift){
                if(['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)){
                    continue
                }
            }
            switch(hotkey.action){
                case 'reroll':{
                    clickQuery('.button-icon-reroll')
                    break
                }
                case 'unreroll':{
                    clickQuery('.button-icon-unreroll')
                    break
                }
                case 'translate':{
                    clickQuery('.button-icon-translate')
                    break
                }
                case 'remove':{
                    clickQuery('.button-icon-remove')
                    break
                }
                case 'edit':{
                    clickQuery('.button-icon-edit')
                    setTimeout(() => {
                        focusQuery('.message-edit-area')
                    }, 100)
                    break
                }
                case 'copy':{
                    clickQuery('.button-icon-copy')
                    break
                }
                case 'focusInput':{
                    focusQuery('.text-input-area')
                    break
                }
                case 'send':{
                    clickQuery('.button-icon-send')
                    break
                }
                case 'settings':{
                    settingsOpen.set(!get(settingsOpen))
                    break
                }
                case 'home':{
                    selectedCharID.set(-1)
                    break
                }
                case 'presets':{
                    modalState.preset = !modalState.preset
                    break
                }
                case 'persona':{
                    modalState.persona = !modalState.persona
                    break
                }
                case 'toggleCSS':{
                    SafeModeStore.set(!get(SafeModeStore))
                    updateTextThemeAndCSS()
                    break
                }
                case 'prevChar':{
                    const sorted = database.characters.map((v, i) => {
                        return {name: v.name, i}
                    }).sort((a, b) => a.name.localeCompare(b.name))
                    const currentIndex = sorted.findIndex(v => v.i === get(selectedCharID))
                    if(currentIndex === 0){
                        return
                    }
                    if(currentIndex >= sorted.length - 1){
                        return
                    }
                    selectedCharID.set(sorted[currentIndex - 1].i)
                    PlaygroundStore.set(0)
                    realmState.expanded = false
                    break
                }
                case 'nextChar':{
                    const sorted = database.characters.map((v, i) => {
                        return {name: v.name, i}
                    }).sort((a, b) => a.name.localeCompare(b.name))
                    const currentIndex = sorted.findIndex(v => v.i === get(selectedCharID))
                    if(currentIndex === 0){
                        return
                    }
                    if(currentIndex >= sorted.length - 1){
                        return
                    }
                    selectedCharID.set(sorted[currentIndex + 1].i)
                    PlaygroundStore.set(0)
                    realmState.expanded = false
                    break
                }
                case 'quickMenu':{
                    quickMenu()
                    break
                }
                case 'previewRequest':{
                    if(get(doingChat) && get(selectedCharID) !== -1){
                        return false
                    }
                    alertWait("Loading...")
                    ev.preventDefault()
                    ev.stopPropagation()
                    await sendChat(-1, {
                        previewPrompt: true
                    })

                    let md = ''
                    md += '### Prompt\n'
                    md += '```json\n' + JSON.stringify(JSON.parse(previewBody), null, 2).replaceAll('```', '\\`\\`\\`') + '\n```\n'
                    doingChat.set(false)
                    alertMd(md)
                    return
                }
                case 'toggleLog':{
                    alertRequestLogs()
                    break
                }
                case 'quickSettings':{
                    QuickSettings.open = !QuickSettings.open
                    QuickSettings.index = 0
                    break
                }
                default:{
                    hotKeyRanThisTime = false
                }
            }

            if(hotKeyRanThisTime){
                hotkeyRan = true
                break
            }
        }

        if(hotkeyRan){
            ev.preventDefault()
            ev.stopPropagation()
            return
        }


        if(ev.ctrlKey){
            switch (ev.key){
                case "1":{
                    changeToPreset(0)
                    ev.preventDefault()
                    ev.stopPropagation()
                    break
                }
                case "2":{
                    changeToPreset(1)
                    ev.preventDefault()
                    ev.stopPropagation()
                    break
                }
                case "3":{
                    changeToPreset(2)
                    ev.preventDefault()
                    ev.stopPropagation()
                    break
                }
                case "4":{
                    changeToPreset(3)
                    ev.preventDefault()
                    ev.stopPropagation()
                    break
                }
                case "5":{
                    changeToPreset(4)
                    ev.preventDefault()
                    ev.stopPropagation()
                    break
                }
                case "6":{
                    changeToPreset(5)
                    ev.preventDefault()
                    ev.stopPropagation()
                    break
                }
                case "7":{
                    changeToPreset(6)
                    ev.preventDefault()
                    ev.stopPropagation()
                    break
                }
                case "8":{
                    changeToPreset(7)
                    ev.preventDefault()
                    ev.stopPropagation()
                    break
                }
                case "9":{
                    changeToPreset(8)
                    ev.preventDefault()
                    ev.stopPropagation()
                    break
                }
            }
        }
        if(ev.key === 'Escape'){
            if(doingAlert()){
                addToast('Alert Closed')
            }
            if(get(settingsOpen)){
                settingsOpen.set(false)
            }
            ev.preventDefault()
        }
        if(ev.key === 'Enter'){
            const alertType = get(alertStore).type
            if(alertType === 'ask' || alertType === 'normal' || alertType === 'error'){
                alertClear('yes')
            }
        }
    })


    let touchs = 0
    let touchStartTime = 0
    //check for triple touch
    document.addEventListener('touchstart', (ev) => {
        touchs++
        if(touchs > 2){
            if(Date.now() - touchStartTime > 300){
                return
            }
            touchs = 0
            if(doingAlert()){
                return
            }
            quickMenu()
        }
        if(touchs === 1){
            touchStartTime = Date.now()
        }
    })
    document.addEventListener('touchend', (ev) => {
        touchs = 0
    })
}

async function quickMenu(){
    const selStr = await alertSelect([
        language.presets,
        language.persona,
        language.cancel
    ])
    const sel = parseInt(selStr)
    if(sel === 0){
        modalState.preset = !modalState.preset
    }
    if(sel === 1){
        modalState.persona = !modalState.persona
    }
}

function clickQuery(query:string){
    const ele = document.querySelector(query) as HTMLElement
    console.log(ele)
    if(ele){
        ele.click()
    }
}

function focusQuery(query:string){
    const ele = document.querySelector(query) as HTMLElement
    if(ele){
        ele.focus()
    }
}



export function initMobileGesture(){

    const pressingPointers = new Map<number, {x:number, y:number}>()

    document.addEventListener('touchstart', (ev) => {
        for(const touch of ev.changedTouches){
            const ele = touch.target as HTMLElement
            if(ele.tagName === 'BUTTON' || ele.tagName === 'INPUT' || ele.tagName === 'SELECT' || ele.tagName === 'TEXTAREA'){
                return
            }
            pressingPointers.set(touch.identifier, {x: touch.clientX, y: touch.clientY})
        }
    }, {
        passive: true
    })
    document.addEventListener('touchend', (ev) => {
        for(const touch of ev.changedTouches){
            const d = pressingPointers.get(touch.identifier)
            const moveX = touch.clientX - d.x
            const moveY = touch.clientY - d.y
            pressingPointers.delete(touch.identifier)

            if(moveX > 50 && Math.abs(moveY) < Math.abs(moveX)){
                if(get(selectedCharID) === -1){
                    if(layoutState.betaMobile.stack > 0){
                        layoutState.betaMobile.stack -= 1
                    }
                }
                else{
                    if(layoutState.betaMobile.sideBar > 0){
                        layoutState.betaMobile.sideBar -= 1
                    }
                }
            }
            else if(moveX < -50 && Math.abs(moveY) < Math.abs(moveX)){
                if(get(selectedCharID) === -1){
                    if(layoutState.betaMobile.stack < 2){
                        layoutState.betaMobile.stack += 1;
                    }
                }
                else{
                    if(layoutState.betaMobile.sideBar < 3){
                        layoutState.betaMobile.sideBar += 1
                    }
                }
            }
        }
    }, {
        passive: true
    })
}

function changeToPreset(num:number){
    if(!doingAlert()){
        const db = getDatabase()
        const pres = db.botPresets
        if(pres.length > num){
            addToast(`Changed to Preset: ${pres[num].name}`)
            changeToPreset2(num)
        }
    }
}
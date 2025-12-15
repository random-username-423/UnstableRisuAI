import { untrack } from "svelte";
import type { character, Database, groupChat } from "./data/storage/types";
import type { simpleCharacterArgument } from "./utils/parser.svelte";
import type { alertData } from "./utils/alert.svelte";
import { moduleUpdate } from "./process/scripting/modules";
import { resetScriptCache } from "./process/scripting/scripts";

export const LayoutState = $state({
    window: { w: 0, h: 0 },
    isDynamicMode: false,
    sidebar: {
        isOpen: typeof window !== 'undefined' ? window.innerWidth > 1024 : true,
        isClosing: false
    },
    viewBox: { width: 12 * 16, height: 12 * 16 }
})

function updateSize() {
    LayoutState.window.w = window.innerWidth
    LayoutState.window.h = window.innerHeight
    LayoutState.isDynamicMode = window.innerWidth <= 1024
}

export const AppState = $state({
    loaded: false,
    loadingText: '',
    safeMode: false,
    playground: 0
})

export const ChatState = $state({
    selectedCharId: -1,
    configSubMenu: 0,
    currentTriggerId: null as string | null,
    emotions: {} as { [key: string]: [string, string, number][] }
})
export const SettingsState = $state({
    isOpen: false,
    menuIndex: -1,
    customGUIOpen: false,
    botMakerMode: false
})
export const ModalState = $state({
    alert: {
        type: 'none',
        msg: 'n',
    } as alertData,
    presetListOpen: false,
    personaListOpen: false,
    hypaV3: {
        modalOpen: false,
        progress: {
            open: false,
            miniMsg: '',
            msg: '',
            subMsg: '',
        }
    }
})

export const MobileState = $state({
    enabled: false,
    currentStack: 0,
    sideBarMenu: 0,
    search: ''
})

export const RealmState = $state({
    isOpen: false,
    frameContent: ''
})

export const RenderState = $state({
    guiReloadPointer: 0,
    chatReloadPointer: {} as Record<number, number>,
    disableHighlight: true,
    showVisualNovel: false,
    hideIcon: false,
    moduleBackground: '',
    customCSS: ''
})



$effect.root(() => {

    $effect(() => {
        const css = RenderState.customCSS
        const q = document.querySelector('#customcss')
        if (q) {
            q.innerHTML = css
        }
        else {
            const s = document.createElement('style')
            s.id = 'customcss'
            s.innerHTML = css
            document.body.appendChild(s)
        }
    })
})

export function createSimpleCharacter(char: character | groupChat) {
    if ((!char) || char.type === 'group') {
        return null
    }

    const simpleChar: simpleCharacterArgument = {
        type: "simple",
        customscript: char.customscript,
        chaId: char.chaId,
        additionalAssets: char.additionalAssets,
        virtualscript: char.virtualscript,
        emotionImages: char.emotionImages,
        triggerscript: char.triggerscript,
    }

    return simpleChar

}

updateSize()
window.addEventListener("resize", updateSize);
export const DBState = $state({
    db: {} as any as Database
});

export const QuickSettings = $state({
    open: false,
    index: 0
})

$effect.root(() => {
    $effect(() => {
        RenderState.guiReloadPointer
        RenderState.chatReloadPointer = {}
        resetScriptCache()
    })
})

$effect.root(() => {
    $effect(() => {
        const charId = ChatState.selectedCharId

        untrack(() => {
            if (DBState?.db?.characters?.[charId]) {
                if (DBState.db.hypaV3 && DBState.db.hypaV3Presets?.[DBState.db.hypaV3PresetId]?.settings?.alwaysToggleOn) {
                    DBState.db.characters[charId].supaMemory = true;
                }
            }
        })
    })
    $effect(() => {
        $state.snapshot(DBState.db.modules)
        DBState?.db?.enabledModules
        DBState?.db?.enabledModules?.length
        DBState?.db?.characters?.[ChatState.selectedCharId]?.chats?.[DBState?.db?.characters?.[ChatState.selectedCharId]?.chatPage]?.modules?.length
        DBState?.db?.characters?.[ChatState.selectedCharId]?.hideChatIcon
        DBState?.db?.characters?.[ChatState.selectedCharId]?.backgroundHTML
        DBState?.db?.moduleIntergration
        moduleUpdate()
    })
})
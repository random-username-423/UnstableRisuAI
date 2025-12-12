import { get } from 'svelte/store';
import { checkNullish } from '../../utils/util';
import { changeLanguage } from '../../../lang';
import { saveAsset as saveImageGlobal } from '../../utils/fileIO';
import { createHypaV3Preset } from '../../process/memory/hypav3Types';

// Types
import type { Database, character, groupChat, Chat } from './types';

// Utils & Defaults
import { baseDatabaseDefaults, presetTemplate } from './utils/defaultDb';
export * from './utils/defaultDb';

// Stores
import { DBState, selectedCharID } from '../../stores.svelte';

// Re-export from env.ts
export { appVer } from '../../utils/env'
export const webAppSubVer = ''

export function setDatabase(data: Database) {
    // 1. Apply simple defaults
    for (const key in baseDatabaseDefaults) {
        // @ts-ignore
        if (checkNullish(data[key])) {
            // @ts-ignore
            data[key] = structuredClone(baseDatabaseDefaults[key]);
        }
    }

    // 2. Defaults with logic or dependencies
    if (checkNullish(data.characters)) {
        data.characters = []
    }
    if (checkNullish(data.botPresets)) {
        const defaultPreset = structuredClone(presetTemplate)
        defaultPreset.name = "Default"
        data.botPresets = [defaultPreset]
    }
    if (checkNullish(data.botPresetsId)) {
        data.botPresetsId = 0
    }
    if (checkNullish(data.loreBook)) {
        data.loreBookPage = 0
        data.loreBook = [{
            name: "My First LoreBook",
            data: []
        }]
    }
    if (checkNullish(data.loreBookPage) || data.loreBook.length < data.loreBookPage) {
        data.loreBookPage = 0
    }
    
    // Formatting Order Logic
    if (!data.formatingOrder.includes('personaPrompt')) {
        data.formatingOrder.splice(data.formatingOrder.indexOf('main'), 0, 'personaPrompt')
    }

    // Personas Logic
    data.selectedPersona ??= 0
    data.personaPrompt ??= ''
    data.personas ??= [{
        name: data.username,
        personaPrompt: "",
        icon: data.userIcon,
        note: data.userNote,
        largePortrait: false
    }]

    // NAI Config Logic
    if (checkNullish(data.NAIImgConfig.v4_prompt)) {
        data.NAIImgConfig.autoSmea = false;
        data.NAIImgConfig.use_coords = false;
        data.NAIImgConfig.legacy_uc = false;
        data.NAIImgConfig.v4_prompt = {
            caption: {
                base_caption: "",
                char_captions: []
            },
            use_coords: false,
            use_order: true
        };
        data.NAIImgConfig.v4_negative_prompt = {
            caption: {
                base_caption: "",
                char_captions: []
            },
            legacy_uc: false,
        };
    }

    // HypaV3 Presets
    data.hypaV3Presets ??= [
        createHypaV3Preset("Default", {
            summarizationPrompt: data.supaMemoryPrompt ? data.supaMemoryPrompt : "",
            ...data.hypaV3Settings
        })
    ]
    if (data.hypaV3Presets.length > 0) {
        data.hypaV3Presets = data.hypaV3Presets.map((preset, i) =>
            createHypaV3Preset(
                preset.name || `Preset ${i + 1}`,
                preset.settings || {}
            )
        )
    }

    // Migrations
    if (data.antiClaudeOverload) { 
        data.antiClaudeOverload = false
        data.antiServerOverloads = true
    }
    
    // Complex Object Defaults
    data.hypaCustomSettings = {
        url: data.hypaCustomSettings?.url ?? "",
        key: data.hypaCustomSettings?.key ?? "",
        model: data.hypaCustomSettings?.model ?? ""
    }

    data.fallbackModels = {
        model: (data.fallbackModels?.model ?? []).filter((v) => v !== ''),
        memory: (data.fallbackModels?.memory ?? []).filter((v) => v !== ''),
        emotion: (data.fallbackModels?.emotion ?? []).filter((v) => v !== ''),
        translate: (data.fallbackModels?.translate ?? []).filter((v) => v !== ''),
        otherAx: (data.fallbackModels?.otherAx ?? []).filter((v) => v !== '')
    }

    // Type Corrections
    if (typeof (data.top_p) !== 'number') {
        data.top_p = 1
    }

    // Web Environment Specifics
    //@ts-ignore
    if (!globalThis.__NODE__ && !window.__TAURI_INTERNALS__) {
        data.promptInfoInsideChat = false
    }

    changeLanguage(data.language)
    setDatabaseLite(data)
}

export function setDatabaseLite(data: Database) {
    DBState.db = data
}

interface getDatabaseOptions {
    snapshot?: boolean
}

export function getDatabase(options: getDatabaseOptions = {}): Database {
    if (options.snapshot) {
        return $state.snapshot(DBState.db) as Database
    }
    return DBState.db as Database
}

export function getCurrentCharacter(options: getDatabaseOptions = {}): character | groupChat {
    const db = getDatabase(options)
    if (!db.characters) {
        db.characters = []
    }
    const char = db.characters?.[get(selectedCharID)]
    return char
}

export function setCurrentCharacter(char: character | groupChat) {
    if (!DBState.db.characters) {
        DBState.db.characters = []
    }
    DBState.db.characters[get(selectedCharID)] = char
}

export function getCharacterByIndex(index: number, options: getDatabaseOptions = {}): character | groupChat {
    const db = getDatabase(options)
    if (!db.characters) {
        db.characters = []
    }
    const char = db.characters?.[index]
    return char
}

export function setCharacterByIndex(index: number, char: character | groupChat) {
    if (!DBState.db.characters) {
        DBState.db.characters = []
    }
    // Update modifiedAt for sync
    char.modifiedAt = Date.now()
    DBState.db.characters[index] = char
}

export function getCurrentChat() {
    const char = getCurrentCharacter()
    return char?.chats[char.chatPage]
}

export function setCurrentChat(chat: Chat) {
    const char = getCurrentCharacter()
    char.chats[char.chatPage] = chat
    setCurrentCharacter(char)
}

export const saveImage = saveImageGlobal

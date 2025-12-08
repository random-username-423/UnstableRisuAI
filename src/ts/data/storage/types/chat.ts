import type { loreBook } from './lorebook';
import type { SerializableHypaV2Data } from '../../../process/memory/hypav2';
import type { SerializableHypaV3Data } from '../../../process/memory/hypav3Types';
import type { OpenAIChat } from '../../../process/index.svelte';

export interface Chat{
    message?: Message[]  // Optional: undefined = not loaded yet (lazy loading)
    note:string
    name:string
    localLore: loreBook[]
    sdData?:string
    supaMemoryData?:string
    hypaV2Data?:SerializableHypaV2Data
    lastMemory?:string
    suggestMessages?:string[]
    isStreaming?:boolean
    scriptstate?:{[key:string]:string|number|boolean}
    modules?:string[]
    id:string
    bindedPersona?:string
    fmIndex?:number
    hypaV3Data?:SerializableHypaV3Data
    folderId?:string
    lastDate?:number
    modifiedAt?:number  // For sync: timestamp of last modification
}

export interface ChatFolder{
    id:string
    name?:string
    color?:string
    folded:boolean
}

export interface Message{
    role: 'user'|'char'
    data: string
    saying?: string
    chatId?:string
    time?: number
    generationInfo?: MessageGenerationInfo
    promptInfo?: MessagePresetInfo
    name?:string
    otherUser?:boolean
    encryptedThinking?: {
        provider: string
        data: any
        tokens?: number
    }[]
}

export interface MessageGenerationInfo{
    model?: string
    generationId?: string
    inputTokens?: number
    outputTokens?: number
    maxContext?: number
    stageTiming?: {
        stage1?: number
        stage2?: number
        stage3?: number
        stage4?: number
    }
}

export interface MessagePresetInfo{
    promptName?: string,
    promptToggles?: {key: string, value: string}[],
    promptText?: OpenAIChat[],
}

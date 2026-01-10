import type { OnnxModelFiles } from 'src/ts/process/transformers'
import type { ChatFolder } from './chat'
import type { Chat } from './chat'
import type { triggerscript as triggerscriptMain } from 'src/ts/process/triggers'

export interface character extends TTSSettings {
    type?: "character"
    name: string
    image?: string
    firstMessage: string
    desc: string
    notes: string
    chats: Chat[]
    chatFolders: ChatFolder[]
    chatPage: number
    viewScreen: 'emotion' | 'none' | 'imggen' | 'vn'
    bias: [string, number][]
    emotionImages: [string, string][]
    globalLore: loreBook[]
    chaId: string
    sdData: [string, string][]
    newGenData?: NewGenData
    customscript: customscript[]
    triggerscript: triggerscript[]
    utilityBot: boolean
    exampleMessage: string
    removedQuotes?: boolean
    creatorNotes: string
    systemPrompt: string
    postHistoryInstructions: string
    alternateGreetings: string[]
    tags: string[]
    creator: string
    characterVersion: string
    personality: string
    scenario: string
    firstMsgIndex: number
    loreSettings?: loreSettings
    loreExt?: any
    additionalData?: {
        tag?: string[]
        creator?: string
        character_version?: string
    }
    supaMemory?: boolean
    additionalAssets?: [string, string, string][]
    replaceGlobalNote: string
    backgroundHTML?: string
    reloadKeys?: number
    backgroundCSS?: string
    license?: string
    private?: boolean
    additionalText: string
    virtualscript?: string
    scriptstate?: { [key: string]: string | number | boolean }
    depth_prompt?: { depth: number; prompt: string }
    extentions?: { [key: string]: any }
    largePortrait?: boolean
    lorePlus?: boolean
    inlayViewScreen?: boolean
    realmId?: string
    imported?: boolean
    trashTime?: number
    nickname?: string
    source?: string[]
    group_only_greetings?: string[]
    creation_date?: number
    modification_date?: number
    ccAssets?: Array<{
        type: string
        uri: string
        name: string
        ext: string
    }>
    defaultVariables?: string
    lowLevelAccess?: boolean
    hideChatIcon?: boolean
    lastInteraction?: number
    translatorNote?: string
    doNotChangeSeperateModels?: boolean
    escapeOutput?: boolean
    prebuiltAssetCommand?: boolean
    prebuiltAssetStyle?: string
    prebuiltAssetExclude?: string[]
    modules?: string[]
}

export interface NewGenData {
    prompt: string
    negative: string
    instructions: string
    emotionInstructions: string
}

interface TTSSettings {
    ttsMode?: string
    ttsSpeech?: string
    ttsReadOnlyQuoted?: boolean
    voicevoxConfig?: {
        speaker?: string
        SPEED_SCALE?: number
        PITCH_SCALE?: number
        INTONATION_SCALE?: number
        VOLUME_SCALE?: number
    }
    naittsConfig?: {
        customvoice?: boolean
        voice?: string
        version?: string
    }
    oaiVoice?: string
    gptSoVitsConfig?: {
        url?: string
        use_auto_path?: boolean
        ref_audio_path?: string
        use_long_audio?: boolean
        ref_audio_data?: {
            fileName: string
            assetId: string
        }
        volume?: number
        text_lang?: "auto" | "auto_yue" | "en" | "zh" | "ja" | "yue" | "ko" | "all_zh" | "all_ja" | "all_yue" | "all_ko"
        text?: string
        use_prompt?: boolean
        prompt?: string | null
        prompt_lang?: "auto" | "auto_yue" | "en" | "zh" | "ja" | "yue" | "ko" | "all_zh" | "all_ja" | "all_yue" | "all_ko"
        top_p?: number
        temperature?: number
        speed?: number
        top_k?: number
        text_split_method?: "cut0" | "cut1" | "cut2" | "cut3" | "cut4" | "cut5"
    }
    fishSpeechConfig?: {
        model?: {
            _id: string
            title: string
            description: string
        }
        chunk_length: number
        normalize: boolean

    }
    hfTTS?: {
        model: string
        language: string
    }
    vits?: OnnxModelFiles
}

export interface groupChat {
    type: 'group'
    image?: string
    firstMessage: string
    chats: Chat[]
    chatFolders: ChatFolder[]
    chatPage: number
    name: string
    viewScreen: 'single' | 'multiple' | 'none' | 'emp'
    characters: string[]
    characterTalks: number[]
    characterActive: boolean[]
    globalLore: loreBook[]
    autoMode: boolean
    useCharacterLore: boolean
    emotionImages: [string, string][]
    customscript: customscript[]
    chaId: string
    alternateGreetings?: string[]
    creatorNotes?: string
    removedQuotes?: boolean
    firstMsgIndex?: number
    loreSettings?: loreSettings
    supaMemory?: boolean
    ttsMode?: string
    suggestMessages?: string[]
    orderByOrder?: boolean
    backgroundHTML?: string
    reloadKeys?: number
    backgroundCSS?: string
    oneAtTime?: boolean
    virtualscript?: string
    lorePlus?: boolean
    trashTime?: number
    nickname?: string
    defaultVariables?: string
    lowLevelAccess?: boolean
    hideChatIcon?: boolean
    lastInteraction?: number

    //lazy hack for typechecking
    voicevoxConfig?: any
    ttsSpeech?: string
    naittsConfig?: any
    oaiVoice?: string
    hfTTS?: any
    vits?: OnnxModelFiles
    gptSoVitsConfig?: any
    fishSpeechConfig?: any
    ttsReadOnlyQuoted?: boolean
    exampleMessage?: string
    systemPrompt?: string
    replaceGlobalNote?: string
    additionalText?: string
    personality?: string
    scenario?: string
    translatorNote?: string
    additionalData?: any
    depth_prompt?: { depth: number; prompt: string }
    additionalAssets?: [string, string, string][]
    utilityBot?: boolean
    license?: string
    realmId: string
    prebuiltAssetCommand?: boolean
    prebuiltAssetStyle?: string
    prebuiltAssetExclude?: string[]
    modules?: string[]
}

export interface loreBook {
    key: string
    secondkey: string
    insertorder: number
    comment: string
    content: string
    mode: 'multiple' | 'constant' | 'normal' | 'child' | 'folder'
    alwaysActive: boolean
    selective: boolean
    extentions?: {
        risu_case_sensitive: boolean
    }
    activationPercent?: number
    loreCache?: {
        key: string
        data: string[]
    }
    useRegex?: boolean
    bookVersion?: number
    id?: string
    folder?: string
}

export interface loreSettings {
    tokenBudget: number
    scanDepth: number
    recursiveScanning: boolean
    fullWordMatching?: boolean
}

export interface customscript {
    comment: string
    in: string
    out: string
    type: string
    flag?: string
    ableFlag?: boolean

}

export type triggerscript = triggerscriptMain;


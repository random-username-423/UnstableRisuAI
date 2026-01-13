import type { Hotkey } from 'src/ts/defaulthotkeys'
import type { ColorScheme } from 'src/ts/gui/colorscheme'
import type { OobaChatCompletionRequestParams } from 'src/ts/model/ooba'
import type { LLMFormat, LLMFlags, LLMTokenizer } from 'src/ts/model/types'
import type { RisuPlugin } from 'src/ts/plugins/plugins'
import type { HypaModel } from 'src/ts/process/memory/hypamemory'
import type { HypaV3Settings, HypaV3Preset } from 'src/ts/process/memory/hypav3.svelte'
import type { NAISettings } from 'src/ts/process/models/nai'
import type { RisuModule } from 'src/ts/process/modules'
import type { PromptItem, PromptSettings } from 'src/ts/process/prompt'
import type { ComfyConfig } from './settings'
import type { sdConfig } from './settings'
import type { NAIImgConfig } from './settings'
import type { AINsettings } from './settings'
import type { OobaSettings } from './settings'
import type { character, groupChat, loreBook, customscript } from './character'
import type { FormatingOrderItem, botPreset } from './preset'


export interface Database extends UISettings, LLMParametersSettings, ImageGenerationSettings, TranslationSettings, MemorySettings, OpenRouterSettings, VertexSettings, LegacySettings {
    characters: (character | groupChat)[]
    forceReplaceUrl2: string
    openAIKey: string
    proxyKey: string
    mainPrompt: string
    jailbreak: string
    globalNote: string
    askRemoval: boolean
    formatingOrder: FormatingOrderItem[]
    aiModel: string
    jailbreakToggle: boolean
    loreBookDepth: number
    loreBookToken: number
    cipherChat: boolean
    loreBook: {
        name: string
        data: loreBook[]
    }[]
    loreBookPage: number
    username: string
    userIcon: string
    userNote: string
    additionalPrompt: string
    descriptionPrefix: string
    forceReplaceUrl: string
    language: string
    plugins: RisuPlugin[]
    currentPluginProvider: string
    lastup: string
    textgenWebUIStreamURL: string
    textgenWebUIBlockingURL: string
    playMessage: boolean
    subModel: string
    timeOut: number
    emotionPrompt: string
    requester: string
    formatversion: number
    botPresets: botPreset[]
    botPresetsId: number
    ttsAutoSpeech?: boolean
    runpodKey: string
    promptPreprocess: boolean
    swipe: boolean
    instantRemove: boolean
    requestRetrys: number
    emotionPrompt2: string
    useSayNothing: boolean
    didFirstSetup: boolean
    requestmet: string
    requestproxy: string
    showUnrecommended: boolean
    elevenLabKey: string
    voicevoxUrl: string
    useExperimental: boolean
    useStreaming: boolean
    textScreenColor?: string
    textBorder?: boolean
    textScreenRounded?: boolean
    textScreenBorder?: string
    characterOrder: (string | folder)[]
    hordeConfig: hordeConfig
    toggleConfirmRecommendedPreset: boolean
    novelai: {
        token: string
        model: string
    }
    globalscript: customscript[]
    sendWithEnter: boolean
    clickToEdit: boolean
    koboldURL: string
    advancedBotSettings: boolean
    useAutoSuggestions: boolean
    autoSuggestPrompt: string
    autoSuggestPrefix: string
    autoSuggestClean: boolean
    claudeAPIKey: string
    useChatCopy: boolean
    novellistAPI: string
    imageCompression: boolean
    account?: {
        token: string
        id: string
        data: {
            refresh_token?: string
            access_token?: string
            expires_in?: number
        }
        useSync?: boolean
        kei?: boolean
    }
    useChatSticker: boolean
    useAdditionalAssetsPreview: boolean
    usePlainFetch: boolean
    proxyRequestModel: string
    ooba: OobaSettings
    ainconfig: AINsettings
    personaPrompt: string
    selectedPersona: number
    personas: {
        personaPrompt: string
        name: string
        icon: string
        largePortrait?: boolean
        id?: string
        note?: string
    }[]
    personaNote: boolean
    botSettingAtStart: false
    NAIsettings: NAISettings
    hideRealm: boolean
    promptTemplate?: PromptItem[]
    forceProxyAsOpenAI?: boolean
    saveTime?: number
    mancerHeader: string
    emotionProcesser: 'submodel' | 'embedding'
    NAIadventure?: boolean
    NAIappendName?: boolean
    localStopStrings?: string[]
    autofillRequestUrl: boolean
    customProxyRequestModel: string
    newOAIHandle: boolean
    putUserOpen: boolean
    inlayImage: boolean
    reverseProxyOobaMode: boolean
    reverseProxyOobaArgs: OobaChatCompletionRequestParams
    automark?: boolean
    huggingfaceKey: string
    fishSpeechKey: string
    allowAllExtentionFiles?: boolean
    google: {
        accessToken: string
        projectId: string
    }
    mistralKey?: string
    genTime: number
    promptSettings: PromptSettings
    keiServerURL: string
    statistics: {
        newYear2024?: {
            messages: number
            chats: number
        }
    }
    claudeAws: boolean
    lastPatchNoteCheckVersion?: string
    modules: RisuModule[]
    enabledModules: string[]
    sideMenuRerollButton?: boolean
    requestInfoInsideChat?: boolean
    additionalParams: [string, string][]
    antiClaudeOverload: boolean
    ollamaURL: string
    ollamaModel: string
    autoContinueChat: boolean
    autoContinueMinTokens: number
    removeIncompleteResponse: boolean
    customTokenizer: string
    instructChatTemplate: string
    JinjaTemplate: string
    useInstructPrompt: boolean
    dynamicAssets: boolean
    dynamicAssetsEditDisplay: boolean
    customPromptTemplateToggle: string
    globalChatVariables: { [key: string]: string }
    templateDefaultVariables: string
    cohereAPIKey: string
    goCharacterOnImport: boolean
    claudeCachingExperimental: boolean
    hideApiKey: boolean
    unformatQuotes: boolean
    enableDevTools: boolean
    moduleIntergration: string
    jsonSchemaEnabled: boolean
    jsonSchema: string
    strictJsonSchema: boolean
    extractJson: string
    ai21Key: string
    statics: {
        messages: number
        imports: number
    }
    customQuotes: boolean
    customQuotesData?: [string, string, string, string]
    groupTemplate?: string
    groupOtherBotRole?: string
    OAIPrediction: string
    customAPIFormat: LLMFormat
    systemContentReplacement: string
    systemRoleReplacement: 'user' | 'assistant'
    lightningRealmImport: boolean
    notification: boolean
    customFlags: LLMFlags[]
    enableCustomFlags: boolean
    googleClaudeTokenizing: boolean
    presetChain: string
    legacyMediaFindings?: boolean
    geminiStream?: boolean
    assetMaxDifference: number
    pluginV2: RisuPlugin[]
    showSavingIcon: boolean
    presetRegex: customscript[]
    banCharacterset: string[]
    showPromptComparison: boolean
    checkCorruption: boolean
    realmDirectOpen: boolean
    OaiCompAPIKeys: { [key: string]: string }
    inlayErrorResponse: boolean
    bulkEnabling: boolean
    showDeprecatedTriggerV1: boolean
    showDeprecatedTriggerV2: boolean
    returnCSSError: boolean
    antiServerOverloads: boolean
    localActivationInGlobalLorebook: boolean
    showFolderName: boolean
    automaticCachePoint: boolean
    chatCompression: boolean
    claudeRetrivalCaching: boolean
    outputImageModal: boolean
    playMessageOnTranslateEnd: boolean
    doNotChangeSeperateModels: boolean
    modelTools: string[]
    hotkeys: Hotkey[]
    fallbackModels: {
        memory: string[]
        emotion: string[]
        translate: string[]
        otherAx: string[]
        model: string[]
    }
    doNotChangeFallbackModels: boolean
    fallbackWhenBlankResponse: boolean
    customModels: {
        id: string
        internalId: string
        url: string
        format: LLMFormat
        tokenizer: LLMTokenizer
        key: string
        name: string
        params: string
        flags: LLMFlags[]
    }[]
    igpPrompt: string
    useTokenizerCaching: boolean
    authRefreshes: {
        url: string
        tokenUrl: string
        refreshToken: string
        clientId: string
        clientSecret: string
    }[]
    promptInfoInsideChat: boolean
    promptTextInfoInsideChat: boolean
    claudeBatching: boolean
    claude1HourCaching: boolean
    rememberToolUsage: boolean
    simplifiedToolUse: boolean
    requestLocation: string
    newImageHandlingBeta?: boolean
    showFirstMessagePages: boolean
    streamGeminiThoughts: boolean
    dynamicOutput?: DynamicOutput
    hubServerType?: string
    pluginCustomStorage: { [key: string]: any }
    sourcemapTranslate: boolean
    promptDiffPrefs: PromptDiffPrefs
    enableBookmark?: boolean
    autoScrollToNewMessage?: boolean
    alwaysScrollToNewMessage?: boolean
    enableScrollToActiveChar: boolean
    newMessageButtonStyle?: string
    pluginDevelopMode?: boolean
    echoMessage?: string
    echoDelay?: number
    createFolderOnBranch?: boolean
}

interface UISettings {
    zoomsize: number
    iconsize: number
    theme: string
    fullScreen: boolean
    roundIcons: boolean
    colorScheme: ColorScheme
    colorSchemeName: string
    font: string
    customFont: string
    lineHeight: number
    textTheme: string
    customTextTheme: {
        FontColorStandard: string
        FontColorBold: string
        FontColorItalic: string
        FontColorItalicBold: string
        FontColorQuote1: string
        FontColorQuote2: string
    }
    customBackground: string
    heightMode: string
    classicMaxWidth: boolean
    waifuWidth: number
    waifuWidth2: number
    assetWidth: number
    animationSpeed: number
    textAreaSize: number
    sideBarSize: number
    textAreaTextSize: number
    menuSideBar: boolean
    showMenuChatList?: boolean
    betaMobileGUI: boolean
    useLegacyGUI: boolean
    customGUI: string
    guiHTML: string
    layoutHTML: string
    customCSS: string
    settingsCloseButtonSize: number
    hideAllImages?: boolean
    fixedChatTextarea: boolean
}

interface LLMParametersSettings {
    temperature: number
    maxContext: number
    maxResponse: number
    frequencyPenalty: number
    PresensePenalty: number
    repetition_penalty: number
    top_p: number
    top_k: number
    min_p: number
    top_a: number
    bias: [string, number][]
    generationSeed: number
    reasoningEffort: number
    thinkingTokens: number
    verbosity: number
    seperateParametersEnabled: boolean
    seperateParameters: {
        memory: SeparateParameters
        emotion: SeparateParameters
        translate: SeparateParameters
        otherAx: SeparateParameters
    }
    seperateModelsForAxModels: boolean
    seperateModels: {
        memory: string
        emotion: string
        translate: string
        otherAx: string
    }
}

interface ImageGenerationSettings {
    sdProvider: string
    webUiUrl: string
    sdSteps: number
    sdCFG: number
    sdConfig: sdConfig
    NAIImgUrl: string
    NAIApiKey: string
    NAIImgModel: string
    NAII2I: boolean
    NAIREF: boolean
    NAIImgConfig: NAIImgConfig
    comfyConfig: ComfyConfig
    comfyUiUrl: string
    stabilityModel: string
    stabilityKey: string
    stabllityStyle: string
    dallEQuality: string
    falToken: string
    falModel: string
    falLora: string
    falLoraName: string
    falLoraScale: number
    gptVisionQuality: string
    ImagenModel: string
    ImagenImageSize: string
    ImagenAspectRatio: string
    ImagenPersonGeneration: string
    openaiCompatImage: {
        url: string
        key: string
        model: string
        size: string
        quality: string
    }
}

interface TranslationSettings {
    translator: string
    translatorType: 'google' | 'deepl' | 'none' | 'llm' | 'deeplX' | 'bergamot'
    autoTranslate: boolean
    useAutoTranslateInput: boolean
    translatorInputLanguage?: string
    htmlTranslation?: boolean
    deeplOptions: {
        key: string
        freeApi: boolean
    }
    deeplXOptions: {
        url: string
        token: string
    }
    translatorPrompt: string
    translatorMaxResponse: number
    combineTranslation: boolean
    legacyTranslation: boolean
    noWaitForTranslate: boolean
    translateBeforeHTMLFormatting: boolean
    autoTranslateCachedOnly: boolean
    showTranslationLoading: boolean
    useExperimentalGoogleTranslator: boolean
}

interface MemorySettings {
    supaMemoryKey: string
    supaModelType: string
    supaMemoryPrompt: string
    maxSupaChunkSize: number
    hanuraiTokens: number
    hanuraiSplit: boolean
    hanuraiEnable: boolean
    hypaMemory: boolean
    hypaMemoryKey: string
    hypaModel: HypaModel
    hypaAllocatedTokens: number
    hypaChunkSize: number
    hypav2: boolean
    hypaV3: boolean
    hypaV3Settings: HypaV3Settings // legacy
    hypaV3Presets: HypaV3Preset[]
    hypaV3PresetId: number
    memoryAlgorithmType: string // To enable new memory module/algorithms 
    removePunctuationHypa?: boolean
    memoryLimitThickness?: number
    showMemoryLimit: boolean
    showMenuHypaMemoryModal: boolean
    hypaCustomSettings: {
        url: string
        key: string
        model: string
    }
}

interface OpenRouterSettings {
    openrouterRequestModel: string
    openrouterKey: string
    openrouterMiddleOut: boolean
    openrouterFallback: boolean
    openrouterProvider: {
        order: string[]
        only: string[]
        ignore: string[]
    }
}

interface VertexSettings {
    vertexPrivateKey: string
    vertexClientEmail: string
    vertexAccessToken: string
    vertexAccessTokenExpires: number
    vertexRegion: string
}

interface LegacySettings {
    apiType: string
    officialplugins: {
        automark?: boolean
        romanizer?: boolean
        metrica?: boolean
        oaiFix?: boolean
        oaiFixEmdash?: boolean
        oaiFixLetters?: boolean
    }
    logShare: boolean
    palmAPI: string
    tpo?: boolean
}

export interface DynamicOutput {
    autoAdjustSchema: boolean
    dynamicMessages: boolean
    dynamicMemory: boolean
    dynamicResponseTiming: boolean
    dynamicOutputPrompt: boolean
    showTypingEffect: boolean
    dynamicRequest: boolean
}

export interface SeparateParameters {
    temperature?: number
    top_k?: number
    repetition_penalty?: number
    min_p?: number
    top_a?: number
    top_p?: number
    frequency_penalty?: number
    presence_penalty?: number
    reasoning_effort?: number
    thinking_tokens?: number
    outputImageModal?: boolean
    verbosity?: number
}

export interface PromptDiffPrefs {
    diffStyle: 'line' | 'intraline'
    formatStyle: 'raw' | 'card'
    viewStyle: 'unified' | 'split'
    isGrouped: boolean
    showOnlyChanges: boolean
    contextRadius: number
}
export interface folder {
    name: string
    data: string[]
    color: string
    id: string
    imgFile?: string
    img?: string
}
export interface hordeConfig {
    apiKey: string
    model: string
    softPrompt: string
}


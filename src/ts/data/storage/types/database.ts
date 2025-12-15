import type { character, groupChat } from './character';
import type { botPreset, FormatingOrderItem } from './preset';
import type { loreBook } from './lorebook';
import type { sdConfig, NAIImgConfig, hordeConfig, customscript, SeparateParameters, DynamicOutput, ComfyConfig, OobaSettings, AINsettings, folder } from './settings';
import type { RisuPlugin } from '../../../plugins/plugins';
import type { NAISettings } from '../../../process/models/nai';
import type { PromptItem, PromptSettings } from '../../../process/utils/prompt';
import type { OobaChatCompletionRequestParams } from '../../../model/ooba';
import type { ColorScheme } from '../../../gui/colorscheme.svelte';
import type { LLMFormat, LLMFlags, LLMTokenizer } from '../../../model/modellist';
import type { HypaV3Settings, HypaV3Preset } from '../../../process/memory/hypav3Types';
import type { Hotkey } from '../../../hotkey/defaulthotkeys';
import type { RisuModule } from 'src/ts/process/scripting/modules';
import type { HypaModel } from '../../../process/memory/hypamemory';

export interface Database{
    // ============================================================
    // Core Data
    // ============================================================
    characters: (character|groupChat)[],
    characterOrder:(string|folder)[]
    formatversion:number
    didFirstSetup: boolean
    lastup:string
    saveTime?:number
    statistics: {
        newYear2024?: {
            messages: number
            chats: number
        }
    },
    statics: {
        messages: number
        imports: number
    }

    // ============================================================
    // User & Persona
    // ============================================================
    username: string
    userIcon: string
    userNote: string
    personaPrompt:string
    selectedPersona:number
    personas:{
        personaPrompt:string
        name:string
        icon:string
        largePortrait?:boolean
        id?:string
        note?:string
    }[]
    personaNote:boolean

    // ============================================================
    // Account & Sync
    // ============================================================
    account?:{
        token:string
        id:string,
        data: {
            refresh_token?:string,
            access_token?:string
            expires_in?: number
        }
        useSync?:boolean
        kei?:boolean
    },
    syncEnabled?:boolean
    lastSyncedVersion?:number
    lastSyncTime?:number
    syncAccessToken?:string
    syncRefreshToken?:string
    syncTokenExpiresAt?:number

    // ============================================================
    // API Keys & Authentication
    // ============================================================
    openAIKey: string
    proxyKey:string
    claudeAPIKey:string,
    claudeAws:boolean
    palmAPI:string,
    openrouterKey:string
    NAIApiKey:string
    mistralKey?:string
    cohereAPIKey:string
    ai21Key:string
    huggingfaceKey:string
    elevenLabKey:string
    fishSpeechKey:string
    stabilityKey: string
    falToken: string
    supaMemoryKey:string
    hypaMemoryKey:string
    mancerHeader:string
    google: {
        accessToken: string
        projectId: string
    }
    vertexPrivateKey: string
    vertexClientEmail: string
    vertexAccessToken: string
    vertexAccessTokenExpires: number
    vertexRegion: string
    OaiCompAPIKeys: {[key:string]:string}
    authRefreshes:{
        url:string
        tokenUrl:string
        refreshToken:string
        clientId:string
        clientSecret:string
    }[]

    // ============================================================
    // AI Models
    // ============================================================
    aiModel: string
    subModel:string
    proxyRequestModel:string
    openrouterRequestModel:string
    customProxyRequestModel:string
    ollamaModel:string
    novelai:{
        token:string,
        model:string
    }
    NAIsettings:NAISettings
    NAIadventure?:boolean,
    NAIappendName?:boolean,
    ooba:OobaSettings
    ainconfig: AINsettings
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
    modelTools: string[]

    // ============================================================
    // Generation Parameters
    // ============================================================
    temperature: number
    maxContext: number
    maxResponse: number
    frequencyPenalty: number
    PresensePenalty: number
    top_p: number,
    top_k:number
    top_a:number
    min_p:number
    repetition_penalty:number
    bias: [string, number][]
    generationSeed:number
    timeOut:number
    verbosity:number

    // ============================================================
    // Prompt Settings
    // ============================================================
    mainPrompt: string
    jailbreak: string
    jailbreakToggle:boolean
    globalNote:string
    additionalPrompt: string
    descriptionPrefix: string
    formatingOrder: FormatingOrderItem[]
    promptTemplate?:PromptItem[]
    promptSettings: PromptSettings
    promptPreprocess:boolean
    customPromptTemplateToggle:string
    templateDefaultVariables:string
    localStopStrings?:string[]
    OAIPrediction:string
    igpPrompt:string

    // ============================================================
    // Auto Suggest
    // ============================================================
    useAutoSuggestions:boolean
    autoSuggestPrompt:string
    autoSuggestPrefix:string
    autoSuggestClean:boolean

    // ============================================================
    // Lorebook
    // ============================================================
    loreBook: {
        name:string
        data:loreBook[]
    }[]
    loreBookPage: number
    loreBookDepth: number
    loreBookToken: number,
    localActivationInGlobalLorebook: boolean

    // ============================================================
    // Memory Systems
    // ============================================================
    supaMemoryPrompt: string
    supaModelType:string
    maxSupaChunkSize:number
    hypaMemory:boolean
    hypav2:boolean
    hypaV3:boolean
    hypaV3Settings: HypaV3Settings // legacy
    hypaV3Presets: HypaV3Preset[]
    hypaV3PresetId: number
    hypaModel:HypaModel
    hypaAllocatedTokens:number
    hypaChunkSize:number
    hypaCustomSettings: {
        url: string,
        key: string,
        model: string,
    },
    memoryAlgorithmType:string
    removePunctuationHypa?:boolean
    memoryLimitThickness?:number
    showMemoryLimit:boolean
    showMenuHypaMemoryModal:boolean
    hanuraiEnable:boolean
    hanuraiSplit:boolean
    hanuraiTokens:number

    // ============================================================
    // Presets
    // ============================================================
    botPresets:botPreset[]
    botPresetsId:number
    toggleConfirmRecommendedPreset:boolean,
    presetChain: string
    presetRegex: customscript[]

    // ============================================================
    // Scripts & Modules
    // ============================================================
    globalscript: customscript[],
    modules: RisuModule[]
    enabledModules: string[]
    moduleIntergration: string

    // ============================================================
    // Plugins
    // ============================================================
    plugins: RisuPlugin[]
    pluginV2: RisuPlugin[]
    officialplugins: {
        automark?: boolean
        romanizer?: boolean
        metrica?: boolean
        oaiFix?: boolean
        oaiFixEmdash?: boolean
        oaiFixLetters?: boolean
    }
    currentPluginProvider: string

    // ============================================================
    // Translation
    // ============================================================
    language: string
    translator: string
    translatorType:'google'|'deepl'|'none'|'llm'|'deeplX'|'bergamot',
    translatorInputLanguage?:string
    translatorPrompt:string
    translatorMaxResponse:number
    autoTranslate: boolean
    useAutoTranslateInput:boolean
    htmlTranslation?:boolean,
    deeplOptions:{
        key:string,
        freeApi:boolean
    }
    deeplXOptions:{
        url:string,
        token:string
    }
    combineTranslation:boolean
    legacyTranslation: boolean
    noWaitForTranslate:boolean
    translateBeforeHTMLFormatting:boolean
    autoTranslateCachedOnly:boolean
    useExperimentalGoogleTranslator:boolean
    showTranslationLoading: boolean

    // ============================================================
    // TTS & Voice
    // ============================================================
    ttsAutoSpeech?:boolean
    playMessage:boolean
    playMessageOnTranslateEnd:boolean
    voicevoxUrl:string

    // ============================================================
    // Emotion
    // ============================================================
    emotionPrompt: string,
    emotionPrompt2:string
    emotionProcesser:'submodel'|'embedding',

    // ============================================================
    // Image Generation
    // ============================================================
    sdProvider: string
    webUiUrl:string
    sdSteps:number
    sdCFG:number
    sdConfig:sdConfig
    NAIImgUrl:string
    NAIImgModel:string
    NAII2I:boolean
    NAIREF:boolean
    NAIImgConfig:NAIImgConfig
    comfyConfig: ComfyConfig
    comfyUiUrl: string
    dallEQuality:string
    stabilityModel: string
    stabllityStyle: string
    falModel: string
    falLora: string
    falLoraName: string
    falLoraScale: number
    ImagenModel:string
    ImagenImageSize:string
    ImagenAspectRatio:string
    ImagenPersonGeneration:string
    inlayImage:boolean
    outputImageModal: boolean

    // ============================================================
    // UI & Theme
    // ============================================================
    theme: string
    colorScheme:ColorScheme
    colorSchemeName:string
    textTheme: string
    customTextTheme: {
        FontColorStandard: string,
        FontColorBold : string,
        FontColorItalic : string,
        FontColorItalicBold : string,
        FontColorQuote1 : string,
        FontColorQuote2 : string
    }
    textScreenColor?:string
    textBorder?:boolean
    textScreenRounded?:boolean
    textScreenBorder?:string
    customBackground:string
    zoomsize:number
    iconsize:number
    roundIcons:boolean
    assetWidth:number
    animationSpeed:number
    waifuWidth:number
    waifuWidth2:number
    fullScreen:boolean
    classicMaxWidth: boolean,
    useLegacyGUI: boolean
    betaMobileGUI:boolean
    customGUI:string
    guiHTML:string
    customCSS: string
    font: string
    customFont: string
    lineHeight: number
    heightMode:string
    textAreaSize:number
    sideBarSize:number
    textAreaTextSize:number
    menuSideBar:boolean
    showMenuChatList?:boolean,
    sideMenuRerollButton?:boolean
    showFolderName: boolean
    showSavingIcon:boolean
    hotkeys:Hotkey[]

    // ============================================================
    // Chat Settings
    // ============================================================
    swipe:boolean
    sendWithEnter:boolean
    fixedChatTextarea:boolean
    clickToEdit: boolean
    useChatCopy:boolean,
    useChatSticker:boolean,
    useAdvancedEditor:boolean
    cipherChat: boolean,
    autoContinueChat:boolean
    autoContinueMinTokens:number
    removeIncompleteResponse:boolean
    useSayNothing:boolean
    askRemoval:boolean
    instantRemove:boolean
    newChatSeparator: boolean
    chatCompression: boolean
    groupTemplate?:string
    groupOtherBotRole?:string
    customQuotes:boolean
    customQuotesData?:[string, string, string, string]
    unformatQuotes: boolean
    globalChatVariables:{[key:string]:string}

    // ============================================================
    // Character Management
    // ============================================================
    goCharacterOnImport:boolean
    useAdditionalAssetsPreview:boolean,
    dynamicAssets:boolean
    dynamicAssetsEditDisplay:boolean
    assetMaxDifference:number

    // ============================================================
    // Network & Request
    // ============================================================
    requestRetrys:number
    requestLocation:string
    forceReplaceUrl: string
    forceProxyAsOpenAI?:boolean
    usePlainFetch:boolean
    useStreaming:boolean
    textgenWebUIStreamURL:string
    textgenWebUIBlockingURL:string
    koboldURL:string
    ollamaURL:string
    reverseProxyOobaMode:boolean
    reverseProxyOobaArgs: OobaChatCompletionRequestParams
    autofillRequestUrl:boolean
    newOAIHandle:boolean
    antiClaudeOverload:boolean
    antiServerOverloads: boolean
    claudeCachingExperimental: boolean
    claudeRetrivalCaching: boolean
    claude1HourCaching:boolean
    claudeBatching:boolean
    automaticCachePoint: boolean
    geminiMergeSystemToUser:boolean
    geminiStream?:boolean
    streamGeminiThoughts:boolean
    googleClaudeTokenizing: boolean
    openrouterMiddleOut:boolean
    openrouterFallback:boolean
    openrouterProvider:string
    openAIServiceTier:string

    // ============================================================
    // Tokenizer & Templates
    // ============================================================
    customTokenizer:string
    instructChatTemplate:string
    JinjaTemplate:string
    useInstructPrompt:boolean
    useTokenizerCaching:boolean

    // ============================================================
    // JSON Schema
    // ============================================================
    jsonSchemaEnabled:boolean
    jsonSchema:string
    strictJsonSchema:boolean
    extractJson:string

    // ============================================================
    // Thinking & Reasoning
    // ============================================================
    chainOfThought?:boolean
    thinkingTokens: number
    thinkingLevel: number
    pastThinkingSend: number
    pastThinkingExtraTokens: number
    reasoningEffort:number

    // ============================================================
    // Separate Parameters
    // ============================================================
    seperateParametersEnabled:boolean
    seperateParameters:{
        memory: SeparateParameters,
        emotion: SeparateParameters,
        translate: SeparateParameters,
        otherAx: SeparateParameters
    }
    seperateModelsForAxModels:boolean
    seperateModels:{
        memory: string
        emotion: string
        translate: string
        otherAx: string
    }
    doNotChangeSeperateModels:boolean

    // ============================================================
    // Fallback Models
    // ============================================================
    fallbackModels: {
        memory: string[],
        emotion: string[],
        translate: string[],
        otherAx: string[]
        model: string[]
    }
    doNotChangeFallbackModels: boolean
    fallbackWhenBlankResponse: boolean

    // ============================================================
    // Custom Flags & API Format
    // ============================================================
    customFlags: LLMFlags[]
    enableCustomFlags: boolean
    customAPIFormat:LLMFormat
    systemContentReplacement:string
    systemRoleReplacement:'user'|'assistant'
    additionalParams:[string, string][]

    // ============================================================
    // Tool Use
    // ============================================================
    rememberToolUsage:boolean
    simplifiedToolUse:boolean

    // ============================================================
    // Backup
    // ============================================================
    driveParallelConnections:number
    maxDbBackups:number
    dbBackupIntervalMinutes:number
    keiServerURL:string

    // ============================================================
    // Vision
    // ============================================================
    gptVisionQuality:string
    geminiVisionQuality:string
    newImageHandlingBeta?: boolean

    // ============================================================
    // Horde
    // ============================================================
    hordeConfig:hordeConfig,

    // ============================================================
    // Realm
    // ============================================================
    hideRealm:boolean
    lightningRealmImport:boolean

    // ============================================================
    // Misc & Feature Flags
    // ============================================================
    useExperimental:boolean
    showUnrecommended:boolean
    advancedBotSettings:boolean
    botSettingAtStart:false
    enableDevTools: boolean
    logShare:boolean
    putUserOpen: boolean
    tpo?:boolean
    automark?:boolean
    allowAllExtentionFiles?:boolean
    imageCompression:boolean
    genTime:number
    lastPatchNoteCheckVersion?:string,
    requestInfoInsideChat?:boolean
    promptInfoInsideChat:boolean
    promptTextInfoInsideChat:boolean
    showPromptComparison:boolean
    checkCorruption:boolean
    inlayErrorResponse:boolean
    bulkEnabling:boolean
    showDeprecatedTriggerV1:boolean
    showDeprecatedTriggerV2:boolean
    returnCSSError:boolean
    showFirstMessagePages:boolean
    notification: boolean
    hideApiKey: boolean
    banCharacterset:string[]
    legacyMediaFindings?:boolean
    novellistAPI:string,
    dynamicOutput?:DynamicOutput
}

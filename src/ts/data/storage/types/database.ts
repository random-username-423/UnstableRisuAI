import type { character, groupChat } from './character';
import type { botPreset, FormatingOrderItem } from './preset';
import type { loreBook } from './lorebook';
import type { sdConfig, NAIImgConfig, hordeConfig, customscript, SeparateParameters, DynamicOutput, ComfyConfig, OobaSettings, AINsettings, folder } from './settings';
import type { RisuPlugin } from '../../../plugins/plugins';
import type { NAISettings } from '../../../process/models/nai';
import type { PromptItem, PromptSettings } from '../../../process/utils/prompt';
import type { OobaChatCompletionRequestParams } from '../../../model/ooba';
import type { ColorScheme } from '../../../gui/colorscheme';
import type { LLMFormat, LLMFlags, LLMTokenizer } from '../../../model/modellist';
import type { HypaV3Settings, HypaV3Preset } from '../../../process/memory/hypav3Types';
import type { Hotkey } from '../../../hotkey/defaulthotkeys';
import type { RisuModule } from 'src/ts/process/scripting/modules';
import type { HypaModel } from '../../../process/memory/hypamemory';

export interface Database{
    characters: (character|groupChat)[],
    openAIKey: string
    proxyKey:string
    mainPrompt: string
    jailbreak: string
    globalNote:string
    temperature: number
    askRemoval:boolean
    maxContext: number
    maxResponse: number
    frequencyPenalty: number
    PresensePenalty: number
    formatingOrder: FormatingOrderItem[]
    aiModel: string
    jailbreakToggle:boolean
    loreBookDepth: number
    loreBookToken: number,
    cipherChat: boolean,
    loreBook: {
        name:string
        data:loreBook[]
    }[]
    loreBookPage: number
    supaMemoryPrompt: string
    username: string
    userIcon: string
    userNote: string
    additionalPrompt: string
    descriptionPrefix: string
    forceReplaceUrl: string
    language: string
    translator: string
    plugins: RisuPlugin[]
    officialplugins: {
        automark?: boolean
        romanizer?: boolean
        metrica?: boolean
        oaiFix?: boolean
        oaiFixEmdash?: boolean
        oaiFixLetters?: boolean
    }
    currentPluginProvider: string
    zoomsize:number
    lastup:string
    customBackground:string
    textgenWebUIStreamURL:string
    textgenWebUIBlockingURL:string
    autoTranslate: boolean
    fullScreen:boolean
    playMessage:boolean
    iconsize:number
    theme: string
    subModel:string
    timeOut:number
    emotionPrompt: string,
    requester:string
    formatversion:number
    waifuWidth:number
    waifuWidth2:number
    botPresets:botPreset[]
    botPresetsId:number
    sdProvider: string
    webUiUrl:string
    sdSteps:number
    sdCFG:number
    sdConfig:sdConfig
    NAIImgUrl:string
    NAIApiKey:string
    NAIImgModel:string
    NAII2I:boolean
    NAIREF:boolean
    NAIImgConfig:NAIImgConfig
    ttsAutoSpeech?:boolean
    runpodKey:string
    promptPreprocess:boolean
    bias: [string, number][]
    swipe:boolean
    instantRemove:boolean
    textTheme: string
    customTextTheme: {
        FontColorStandard: string,
        FontColorBold : string,
        FontColorItalic : string,
        FontColorItalicBold : string,
        FontColorQuote1 : string,
        FontColorQuote2 : string
    }
    requestRetrys:number
    driveParallelConnections:number
    maxDbBackups:number
    dbBackupIntervalMinutes:number
    emotionPrompt2:string
    useSayNothing:boolean
    didFirstSetup: boolean
    requestmet: string
    requestproxy: string
    showUnrecommended:boolean
    elevenLabKey:string
    voicevoxUrl:string
    useExperimental:boolean
    showMemoryLimit:boolean
    roundIcons:boolean
    useStreaming:boolean
    palmAPI:string,
    supaMemoryKey:string
    hypaMemoryKey:string
    supaModelType:string
    textScreenColor?:string
    textBorder?:boolean
    textScreenRounded?:boolean
    textScreenBorder?:string
    characterOrder:(string|folder)[]
    hordeConfig:hordeConfig,
    toggleConfirmRecommendedPreset:boolean,
    novelai:{
        token:string,
        model:string
    }
    globalscript: customscript[],
    sendWithEnter:boolean
    fixedChatTextarea:boolean
    clickToEdit: boolean
    koboldURL:string
    advancedBotSettings:boolean
    useAutoSuggestions:boolean
    autoSuggestPrompt:string
    autoSuggestPrefix:string
    autoSuggestClean:boolean
    claudeAPIKey:string,
    useChatCopy:boolean,
    novellistAPI:string,
    useAutoTranslateInput:boolean
    imageCompression:boolean
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
    classicMaxWidth: boolean,
    useChatSticker:boolean,
    useAdditionalAssetsPreview:boolean,
    usePlainFetch:boolean
    hypaMemory:boolean
    hypav2:boolean
    memoryAlgorithmType:string // To enable new memory module/algorithms 
    proxyRequestModel:string
    ooba:OobaSettings
    ainconfig: AINsettings
    personaPrompt:string
    openrouterRequestModel:string
    openrouterKey:string
    openrouterMiddleOut:boolean
    openrouterFallback:boolean
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
    assetWidth:number
    animationSpeed:number
    botSettingAtStart:false
    NAIsettings:NAISettings
    hideRealm:boolean
    colorScheme:ColorScheme
    colorSchemeName:string
    promptTemplate?:PromptItem[]
    forceProxyAsOpenAI?:boolean
    hypaModel:HypaModel
    saveTime?:number
    mancerHeader:string
    emotionProcesser:'submodel'|'embedding',
    showMenuChatList?:boolean,
    translatorType:'google'|'deepl'|'none'|'llm'|'deeplX'|'bergamot',
    translatorInputLanguage?:string
    htmlTranslation?:boolean,
    NAIadventure?:boolean,
    NAIappendName?:boolean,
    deeplOptions:{
        key:string,
        freeApi:boolean
    }
    deeplXOptions:{
        url:string,
        token:string    
    }
    localStopStrings?:string[]
    autofillRequestUrl:boolean
    customProxyRequestModel:string
    generationSeed:number
    newOAIHandle:boolean
    putUserOpen: boolean
    inlayImage:boolean
    gptVisionQuality:string
    geminiVisionQuality:string
    geminiMergeSystemToUser:boolean
    reverseProxyOobaMode:boolean
    reverseProxyOobaArgs: OobaChatCompletionRequestParams
    tpo?:boolean
    automark?:boolean
    huggingfaceKey:string
    fishSpeechKey:string
    allowAllExtentionFiles?:boolean
    translatorPrompt:string
    translatorMaxResponse:number
    top_p: number,
    google: {
        accessToken: string
        projectId: string
    }
    mistralKey?:string
    chainOfThought?:boolean
    genTime:number
    promptSettings: PromptSettings
    keiServerURL:string
    statistics: {
        newYear2024?: {
            messages: number
            chats: number
        }
    },
    top_k:number
    repetition_penalty:number
    min_p:number
    top_a:number
    claudeAws:boolean
    lastPatchNoteCheckVersion?:string,
    removePunctuationHypa?:boolean
    memoryLimitThickness?:number
    modules: RisuModule[]
    enabledModules: string[]
    sideMenuRerollButton?:boolean
    requestInfoInsideChat?:boolean
    additionalParams:[string, string][]
    heightMode:string
    useAdvancedEditor:boolean
    noWaitForTranslate:boolean
    antiClaudeOverload:boolean
    maxSupaChunkSize:number
    ollamaURL:string
    ollamaModel:string
    autoContinueChat:boolean
    autoContinueMinTokens:number
    removeIncompleteResponse:boolean
    customTokenizer:string
    instructChatTemplate:string
    JinjaTemplate:string
    openrouterProvider:string
    useInstructPrompt:boolean
    hanuraiTokens:number
    hanuraiSplit:boolean
    hanuraiEnable:boolean
    textAreaSize:number
    sideBarSize:number
    textAreaTextSize:number
    combineTranslation:boolean
    dynamicAssets:boolean
    dynamicAssetsEditDisplay:boolean
    customPromptTemplateToggle:string
    globalChatVariables:{[key:string]:string}
    templateDefaultVariables:string
    hypaAllocatedTokens:number
    hypaChunkSize:number
    cohereAPIKey:string
    goCharacterOnImport:boolean
    dallEQuality:string
    font: string
    customFont: string
    lineHeight: number
    stabilityModel: string
    stabilityKey: string
    stabllityStyle: string
    legacyTranslation: boolean
    comfyConfig: ComfyConfig
    comfyUiUrl: string
    useLegacyGUI: boolean
    claudeCachingExperimental: boolean
    hideApiKey: boolean
    unformatQuotes: boolean
    enableDevTools: boolean
    falToken: string
    falModel: string
    falLora: string
    falLoraName: string
    falLoraScale: number
    moduleIntergration: string
    customCSS: string
    betaMobileGUI:boolean
    jsonSchemaEnabled:boolean
    jsonSchema:string
    strictJsonSchema:boolean
    extractJson:string
    ai21Key:string
    statics: {
        messages: number
        imports: number
    }
    customQuotes:boolean
    customQuotesData?:[string, string, string, string]
    groupTemplate?:string
    groupOtherBotRole?:string
    customGUI:string
    guiHTML:string
    logShare:boolean
    OAIPrediction:string
    customAPIFormat:LLMFormat
    systemContentReplacement:string
    systemRoleReplacement:'user'|'assistant'
    vertexPrivateKey: string
    vertexClientEmail: string
    vertexAccessToken: string
    vertexAccessTokenExpires: number
    vertexRegion: string
    seperateParametersEnabled:boolean
    seperateParameters:{
        memory: SeparateParameters,
        emotion: SeparateParameters,
        translate: SeparateParameters,
        otherAx: SeparateParameters
    }
    translateBeforeHTMLFormatting:boolean
    autoTranslateCachedOnly:boolean
    lightningRealmImport:boolean
    notification: boolean
    customFlags: LLMFlags[]
    enableCustomFlags: boolean
    googleClaudeTokenizing: boolean
    presetChain: string
    legacyMediaFindings?:boolean
    geminiStream?:boolean
    assetMaxDifference:number
    menuSideBar:boolean
    pluginV2: RisuPlugin[]
    showSavingIcon:boolean
    presetRegex: customscript[]
    banCharacterset:string[]
    showPromptComparison:boolean
    checkCorruption:boolean
    hypaV3:boolean
    hypaV3Settings: HypaV3Settings // legacy
    hypaV3Presets: HypaV3Preset[]
    hypaV3PresetId: number
    OaiCompAPIKeys: {[key:string]:string}
    inlayErrorResponse:boolean
    reasoningEffort:number
    bulkEnabling:boolean
    showTranslationLoading: boolean
    showDeprecatedTriggerV1:boolean
    showDeprecatedTriggerV2:boolean
    returnCSSError:boolean
    useExperimentalGoogleTranslator:boolean
    thinkingTokens: number
    thinkingLevel: number
    pastThinkingSend: number        // 0: None, 1: Send, 2: Send (Extra Context)
    pastThinkingExtraTokens: number // Extra Context mode token budget
    antiServerOverloads: boolean
    newChatSeparator: boolean
    hypaCustomSettings: {
        url: string,
        key: string,
        model: string,       
    },
    localActivationInGlobalLorebook: boolean
    showFolderName: boolean
    automaticCachePoint: boolean
    chatCompression: boolean
    claudeRetrivalCaching: boolean
    outputImageModal: boolean
    playMessageOnTranslateEnd:boolean
    seperateModelsForAxModels:boolean
    seperateModels:{
        memory: string
        emotion: string
        translate: string
        otherAx: string
    }
    doNotChangeSeperateModels:boolean
    modelTools: string[]
    hotkeys:Hotkey[]
    fallbackModels: {
        memory: string[],
        emotion: string[],
        translate: string[],
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
    igpPrompt:string
    useTokenizerCaching:boolean
    showMenuHypaMemoryModal:boolean
    authRefreshes:{
        url:string
        tokenUrl:string
        refreshToken:string
        clientId:string
        clientSecret:string
    }[]
    promptInfoInsideChat:boolean
    promptTextInfoInsideChat:boolean
    claudeBatching:boolean
    claude1HourCaching:boolean
    rememberToolUsage:boolean
    simplifiedToolUse:boolean
    requestLocation:string
    newImageHandlingBeta?: boolean
    showFirstMessagePages:boolean
    streamGeminiThoughts:boolean
    verbosity:number
    dynamicOutput?:DynamicOutput
    ImagenModel:string
    ImagenImageSize:string
    ImagenAspectRatio:string
    ImagenPersonGeneration:string
    openAIServiceTier:string
    // Sync settings
    syncEnabled?:boolean           // Enable real-time sync
    lastSyncedVersion?:number      // Last synced manifest version
    lastSyncTime?:number           // Last sync timestamp
    syncAccessToken?:string        // Google OAuth access token
    syncRefreshToken?:string       // Google OAuth refresh token
    syncTokenExpiresAt?:number     // Token expiration timestamp
}

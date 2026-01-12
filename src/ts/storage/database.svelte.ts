import { get } from 'svelte/store';
import { changeLanguage } from '../../lang';
import { saveAsset as saveImageGlobal } from '../globalApi.svelte';
import { defaultAutoSuggestPrompt, defaultJailbreak, defaultMainPrompt } from './defaultPrompts';
import { prebuiltNAIpresets } from '../process/templates/templates';
import { defaultColorScheme } from '../gui/colorscheme';
import { createHypaV3Preset } from '../process/memory/hypav3Preset'
import { isTauri, isNodeServer } from "src/ts/platform"
import { DBState, selectedCharID } from '../stores.svelte';
import { LLMFormat } from '../model/modellist';
import { defaultHotkeys } from '../defaulthotkeys';
import type { character, groupChat } from './types/character';
import type { Chat } from './types/chat';
import type { botPreset } from './types/preset';
import type { Database } from './types/database';
import type { AINsettings, OobaSettings } from './types/settings';

//APP_VERSION_POINT is to locate the app version in the database file for version bumping
export const appVer = "2026.1.90" //<APP_VERSION_POINT>
export const webAppSubVer = ''

export function setDatabase(data:Database){
    data.characters ??= []
    data.apiType ??= 'gemini-3-flash-preview'
    data.openAIKey ??= ''
    data.mainPrompt ??= defaultMainPrompt
    data.jailbreak ??= defaultJailbreak
    data.globalNote ??= ``
    data.temperature ??= 80
    data.maxContext ??= 4000
    data.maxResponse ??= 500
    data.frequencyPenalty ??= 70
    data.PresensePenalty ??= 70
    data.aiModel ??= 'gemini-3-flash-preview'
    data.jailbreakToggle ??= false
    data.formatingOrder ??= ['main','description', 'personaPrompt','chats','lastChat','jailbreak','lorebook', 'globalNote', 'authorNote']
    data.loreBookDepth ??= 5
    data.loreBookToken ??= 800
    data.username ??= 'User'
    data.userIcon ??= ''
    data.userNote ??= ''
    data.additionalPrompt ??= 'The assistant must act as {{char}}. user is {{user}}.'
    data.descriptionPrefix ??= 'description of {{char}}: '
    data.forceReplaceUrl ??= ''
    data.forceReplaceUrl2 ??= ''
    data.language ??= 'en'
    data.swipe ??= true
    data.translator ??= ''
    data.translatorMaxResponse ??= 1000
    data.currentPluginProvider ??= ''
    data.plugins ??= []
    data.zoomsize ??= 100
    data.lastup ??= ''
    data.customBackground ??= ''
    data.textgenWebUIStreamURL ??= 'wss://localhost/api/'
    data.textgenWebUIBlockingURL ??= 'https://localhost/api/'
    data.autoTranslate ??= false
    data.fullScreen ??= false
    data.playMessage ??= false
    data.iconsize ??= 100
    data.theme ??= ''
    data.subModel ??= 'gemini-3-flash-preview'
    data.timeOut ??= 120
    data.waifuWidth ??= 100
    data.waifuWidth2 ??= 100
    data.emotionPrompt ??= ""
    data.requester ??= "new"
    data.proxyKey ??= ""
    if(data.botPresets == null){
        const defaultPreset = presetTemplate
        defaultPreset.name = "Default"
        data.botPresets = [defaultPreset]
    }
    data.botPresetsId ??= 0
    data.sdProvider ??= ''
    data.runpodKey ??= ''
    data.webUiUrl ??= 'http://127.0.0.1:7860/'
    data.sdSteps ??= 30
    data.sdCFG ??= 7
    data.NAIImgUrl ??= 'https://image.novelai.net/ai/generate-image'
    data.NAIApiKey ??= ''
    data.NAIImgModel ??= 'nai-diffusion-4-5-full'
    data.NAII2I ??= false
    data.NAIREF ??= false
    data.textTheme ??= "standard"
    data.emotionPrompt2 ??= ""
    data.requestRetrys ??= 2
    data.useSayNothing ??= true
    data.bias ??= []
    data.requestmet ??= 'normal'
    data.requestproxy ??= ''
    data.showUnrecommended ??= false
    data.elevenLabKey ??= ''
    data.voicevoxUrl ??= ''
    data.supaMemoryPrompt ??= ''
    data.showMemoryLimit ??= false
    data.showFirstMessagePages ??= false
    data.supaMemoryKey ??= ""
    data.hypaMemoryKey ??= ""
    data.supaModelType ??= "none"
    data.askRemoval ??= true
    data.sdConfig ??= {
        width:512,
        height:512,
        sampler_name:"Euler a",
        script_name:"",
        denoising_strength:0.7,
        enable_hr:false,
        hr_scale:1.25,
        hr_upscaler:"Latent"
    }
    data.NAIImgConfig ??= {
        width:1024,
        height:1024,
        sampler:"k_euler_ancestral",
        noise_schedule:"karras",
        steps:28,
        scale:5,
        cfg_rescale: 0,
        sm:true,
        sm_dyn:false,
        noise:0.0,
        strength:0.6,
        image:"",
        base64image:"",
        InfoExtracted:1,
        //add 4
        autoSmea:false,
        legacy_uc:false,
        use_coords:false,
        v4_prompt:{
            caption:{
                base_caption:'',
                char_captions:[]
            },
            use_coords:false,
            use_order:true
        },
        v4_negative_prompt:{
            caption:{
                base_caption:'',
                char_captions:[]
            },
            legacy_uc:false,
        },
        variety_plus: false,
        decrisp: false,
        reference_mode: '',
        character_image: '',
        character_base64image: '',
        style_aware: false,
    }
    //add NAI v4 (사용중인 사람용 추가 DB Init)
    if(data.NAIImgConfig.v4_prompt == null){
        data.NAIImgConfig.autoSmea = false;
        data.NAIImgConfig.use_coords = false;
        data.NAIImgConfig.legacy_uc = false;
        data.NAIImgConfig.v4_prompt = {
            caption:{
                base_caption:"",
                char_captions:[]
            },
            use_coords:false,
            use_order:true
        };
        data.NAIImgConfig.v4_negative_prompt = {
            caption:{
                base_caption:"",
                char_captions:[]
            },
            legacy_uc:false,
        };
    }
    data.customTextTheme ??= {
        FontColorStandard: "#f8f8f2",
        FontColorBold: "#f8f8f2",
        FontColorItalic: "#8C8D93",
        FontColorItalicBold: "#8C8D93",
        FontColorQuote1: '#8BE9FD',
        FontColorQuote2: '#FFB86C'
    }
    data.hordeConfig ??= {
        apiKey: "",
        model: "",
        softPrompt: ""
    }
    data.novelai ??= {
        token: "",
        model: "clio-v1",
    }
    if(data.loreBook == null){
        data.loreBookPage = 0
        data.loreBook = [{
            name: "My First LoreBook",
            data: []
        }]
    }
    if(data.loreBookPage == null || data.loreBook.length < data.loreBookPage){
        data.loreBookPage = 0
    }
    data.globalscript ??= []
    data.sendWithEnter ??= true
    data.autoSuggestPrompt ??= defaultAutoSuggestPrompt
    data.autoSuggestPrefix ??= ""
    data.OAIPrediction ??= ''
    data.autoSuggestClean ??= true
    data.imageCompression ??= true
    if(!data.formatingOrder.includes('personaPrompt')){
        data.formatingOrder.splice(data.formatingOrder.indexOf('main'),0,'personaPrompt')
    }
    data.selectedPersona ??= 0
    data.personaPrompt ??= ''
    data.personas ??= [{
        name: data.username,
        personaPrompt: "",
        icon: data.userIcon,
        note: data.userNote,
        largePortrait: false
    }]
    data.classicMaxWidth ??= false
    data.ooba ??= safeStructuredClone(defaultOoba)
    data.ainconfig ??= safeStructuredClone(defaultAIN)
    data.openrouterKey ??= ''
    data.openrouterRequestModel ??= 'openai/gpt-3.5-turbo'
    data.toggleConfirmRecommendedPreset ??= true
    data.officialplugins ??= {}
    data.NAIsettings ??= safeStructuredClone(prebuiltNAIpresets)
    data.assetWidth ??= -1
    data.animationSpeed ??= 0.4
    data.colorScheme ??= safeStructuredClone(defaultColorScheme)
    data.colorSchemeName ??= 'default'
    data.NAIsettings.starter ??= ""
    data.hypaModel ??= 'MiniLM'
    data.mancerHeader ??= ''
    data.emotionProcesser ??= 'submodel'
    data.translatorType ??= 'google'
    data.htmlTranslation ??= false
    data.deeplOptions ??= {
        key:'',
        freeApi: false
    }
    data.deeplXOptions ??= {
        url:'',
        token:''
    } 
    data.NAIadventure ??= false
    data.NAIappendName ??= true
    data.NAIsettings.cfg_scale ??= 1
    data.NAIsettings.mirostat_tau ??= 0
    data.NAIsettings.mirostat_lr ??= 1
    data.autofillRequestUrl ??= true
    data.customProxyRequestModel ??= ''
    data.generationSeed ??= -1
    data.newOAIHandle ??= true
    data.gptVisionQuality ??= 'low'
    data.huggingfaceKey ??= ''
    data.fishSpeechKey ??= ''
    data.statistics ??= {}
    data.presetRegex ??= []
    data.reverseProxyOobaArgs ??= {
        mode: 'instruct'
    }
    data.top_p ??= 1
    if(typeof(data.top_p) !== 'number'){
        //idk why type changes, but it does so this is a fix
        data.top_p = 1
    }
    //@ts-expect-error data.google has required fields (accessToken, projectId), but we use empty object as default and populate below
    data.google ??= {}
    data.google.accessToken ??= ''
    data.google.projectId ??= ''
    data.genTime ??= 1
    data.promptSettings ??= {
        assistantPrefill: '',
        postEndInnerFormat: '',
        sendChatAsSystem: false,
        sendName: false,
        utilOverride: false,
        maxThoughtTagDepth: -1
    }
    data.keiServerURL ??= ''
    data.top_k ??= 0
    data.promptSettings.maxThoughtTagDepth ??= -1
    data.openrouterFallback ??= true
    data.openrouterMiddleOut ??= false
    data.removePunctuationHypa ??= true
    data.memoryLimitThickness ??= 1
    data.modules ??= []
    data.enabledModules ??= []
    data.additionalParams ??= []
    data.heightMode ??= 'normal'
    data.antiClaudeOverload ??= false
    data.maxSupaChunkSize ??= 1200
    data.ollamaURL ??= ''
    data.ollamaModel ??= ''
    data.autoContinueChat ??= false
    data.autoContinueMinTokens ??= 0
    data.repetition_penalty ??= 1
    data.min_p ??= 0
    data.top_a ??= 0
    data.customTokenizer ??= 'tik'
    data.instructChatTemplate ??= "chatml"
    // Migration: convert old string type into new provider object
    if (typeof data.openrouterProvider === 'string') {
        const oldProvider = data.openrouterProvider as unknown as string;
        data.openrouterProvider = {
            order: oldProvider ? [oldProvider] : [],
            only: [],
            ignore: []
        }
    }
    if (data.botPresets) {
        for (const preset of data.botPresets) {
            if (typeof preset.openrouterProvider === 'string') {
                const oldProvider = preset.openrouterProvider as unknown as string;
                preset.openrouterProvider = {
                    order: oldProvider ? [oldProvider] : [],
                    only: [],
                    ignore: []
                }
            }
        }
    }
    data.openrouterProvider ??= {
        order: [],
        only: [],
        ignore: []
    }
    data.useInstructPrompt ??= false
    data.hanuraiEnable ??= false
    data.hanuraiSplit ??= false
    data.hanuraiTokens ??= 1000
    data.textAreaSize ??= 0
    data.sideBarSize ??= 0
    data.textAreaTextSize ??= 0
    data.combineTranslation ??= false
    data.customPromptTemplateToggle ??= ''
    data.globalChatVariables ??= {}
    data.templateDefaultVariables ??= ''
    data.hypaAllocatedTokens ??= 3000
    data.hypaChunkSize ??= 3000
    data.dallEQuality ??= 'standard'
    data.customTextTheme.FontColorQuote1 ??= '#8BE9FD'
    data.customTextTheme.FontColorQuote2 ??= '#FFB86C'
    data.font ??= 'default'
    data.customFont ??= ''
    data.lineHeight ??= 1.25
    data.stabilityModel ??= 'sd3-large'
    data.stabllityStyle ??= ''
    data.legacyTranslation ??= false
    data.comfyUiUrl ??= 'http://localhost:8188'
    data.comfyConfig ??= {
        workflow: '',
        posNodeID: '',
        posInputName: 'text',
        negNodeID: '',
        negInputName: 'text',
        timeout: 30
    }
    data.hideApiKey ??= true
    data.unformatQuotes ??= false
    data.ttsAutoSpeech ??= false
    data.translatorInputLanguage ??= 'auto'
    data.falModel ??= 'fal-ai/flux/dev'
    data.falLoraScale ??= 1
    data.customCSS ??= ''
    data.strictJsonSchema ??= true
    data.statics ??= {
        messages: 0,
        imports: 0
    }
    data.customQuotes ??= false
    data.customQuotesData ??= ['“','”','‘','’']
    data.groupOtherBotRole ??= 'user'
    data.customGUI ??= ''
    data.customAPIFormat ??= LLMFormat.OpenAICompatible
    data.systemContentReplacement ??= `system: {{slot}}`
    data.systemRoleReplacement ??= 'user'
    data.vertexAccessToken ??= ''
    data.vertexAccessTokenExpires ??= 0
    data.vertexClientEmail ??= ''
    data.vertexPrivateKey ??= ''
    data.vertexRegion ??= 'global'
    data.seperateParametersEnabled ??= false
    data.seperateParameters ??= {
        memory: {},
        emotion: {},
        translate: {},
        otherAx: {}
    }
    data.customFlags ??= []
    data.enableCustomFlags ??= false
    data.assetMaxDifference ??= 4
    data.showSavingIcon ??= false
    data.banCharacterset ??= []
    data.showPromptComparison ??= false
    data.checkCorruption ??= true
    data.OaiCompAPIKeys ??= {}
    data.reasoningEffort ??= 0
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
    data.hypaV3PresetId ??= 0
    data.showDeprecatedTriggerV2 ??= false
    data.returnCSSError ??= true
    data.realmDirectOpen ??= false
    data.useExperimentalGoogleTranslator ??= false
    if(data.antiClaudeOverload){ //migration
        data.antiClaudeOverload = false
        data.antiServerOverloads = true
    }
    data.hypaCustomSettings = {
        url: data.hypaCustomSettings?.url ?? "",
        key: data.hypaCustomSettings?.key ?? "",
        model: data.hypaCustomSettings?.model ?? ""     
    }
    data.doNotChangeSeperateModels ??= false
    data.modelTools ??= []
    data.hotkeys ??= safeStructuredClone(defaultHotkeys)
    data.fallbackModels ??= {
        memory: [],
        emotion: [],
        translate: [],
        otherAx: [],
        model: []
    }
    data.fallbackModels = {
        model: data.fallbackModels.model.filter((v) => v !== ''),
        memory: data.fallbackModels.memory.filter((v) => v !== ''),
        emotion: data.fallbackModels.emotion.filter((v) => v !== ''),
        translate: data.fallbackModels.translate.filter((v) => v !== ''),
        otherAx: data.fallbackModels.otherAx.filter((v) => v !== '')
    }
    data.customModels ??= []
    data.authRefreshes ??= []
    data.rememberToolUsage ??= true
    data.simplifiedToolUse ??= false
    data.streamGeminiThoughts ??= false
    data.sourcemapTranslate ??= false
    data.settingsCloseButtonSize ??= 24
    data.hideAllImages ??= false
    data.ImagenModel ??= 'imagen-4.0-generate-001'
    data.ImagenImageSize ??= '1K'
    data.ImagenAspectRatio ??= '1:1'
    data.ImagenPersonGeneration ??= 'allow_all'
    data.openaiCompatImage ??= {
        url: '',
        key: '',
        model: '',
        size: '1024x1024',
        quality: 'auto'
    }
    data.autoScrollToNewMessage ??= true
    data.alwaysScrollToNewMessage ??= false
    data.newMessageButtonStyle ??= 'bottom-center'
    data.echoMessage ??= "Echo Message"
    data.echoDelay ??= 0
    if(!isNodeServer && !isTauri){
        //this is intended to forcely reduce the size of the database in web
        data.promptInfoInsideChat = false
    }
    data.createFolderOnBranch ??= true
    changeLanguage(data.language)
    setDatabaseLite(data)
}

export function setDatabaseLite(data:Database){
    DBState.db = data
}

interface getDatabaseOptions{
    snapshot?:boolean
}

export function getDatabase(options:getDatabaseOptions = {}):Database{
    if(options.snapshot){
        return $state.snapshot(DBState.db) as Database
    }
    return DBState.db as Database
}

export function getCurrentCharacter(options:getDatabaseOptions = {}):character|groupChat{
    const db = getDatabase(options)
    if(!db.characters){
        db.characters = []
    }
    const char = db.characters?.[get(selectedCharID)]
    return char
}

export function setCurrentCharacter(char:character|groupChat){
    if(!DBState.db.characters){
        DBState.db.characters = []
    }
    DBState.db.characters[get(selectedCharID)] = char
}

export function getCharacterByIndex(index:number,options:getDatabaseOptions = {}):character|groupChat{
    const db = getDatabase(options)
    if(!db.characters){
        db.characters = []
    }
    const char = db.characters?.[index]
    return char
}

export function setCharacterByIndex(index:number,char:character|groupChat){
    if(!DBState.db.characters){
        DBState.db.characters = []
    }
    DBState.db.characters[index] = char
}

export function getCurrentChat(){
    const char = getCurrentCharacter()
    return char?.chats[char.chatPage]
}

export function setCurrentChat(chat:Chat){
    const char = getCurrentCharacter()
    char.chats[char.chatPage] = chat
    setCurrentCharacter(char)
}

type OutputModal = 'image'|'audio'|'video'

export const saveImage = saveImageGlobal

export const defaultAIN:AINsettings = {
    top_p: 0.7,
    rep_pen: 1.0625,
    top_a: 0.08,
    rep_pen_slope: 1.7,
    rep_pen_range: 1024,
    typical_p: 1.0,
    badwords: '',
    stoptokens: '',
    top_k: 140
}

export const defaultOoba:OobaSettings = {
    max_new_tokens: 180,
    do_sample: true,
    temperature: 0.7,
    top_p: 0.9,
    typical_p: 1,
    repetition_penalty: 1.15,
    encoder_repetition_penalty: 1,
    top_k: 20,
    min_length: 0,
    no_repeat_ngram_size: 0,
    num_beams: 1,
    penalty_alpha: 0,
    length_penalty: 1,
    early_stopping: false,
    seed: -1,
    add_bos_token: true,
    truncation_length: 4096,
    ban_eos_token: false,
    skip_special_tokens: true,
    top_a: 0,
    tfs: 1,
    epsilon_cutoff: 0,
    eta_cutoff: 0,
    formating:{
        header: "Below is an instruction that describes a task. Write a response that appropriately completes the request.",
        systemPrefix: "### Instruction:",
        userPrefix: "### Input:",
        assistantPrefix: "### Response:",
        seperator:"",
        useName:false,
    }
}


export const presetTemplate:botPreset = {
    name: "New Preset",
    apiType: "gemini-3-flash-preview",
    openAIKey: "",
    mainPrompt: defaultMainPrompt,
    jailbreak: defaultJailbreak,
    globalNote: "",
    temperature: 80,
    maxContext: 4000,
    maxResponse: 300,
    frequencyPenalty: 70,
    PresensePenalty: 70,
    formatingOrder: ['main', 'description', 'personaPrompt','chats','lastChat', 'jailbreak', 'lorebook', 'globalNote', 'authorNote'],
    aiModel: "gemini-3-flash-preview",
    subModel: "gemini-3-flash-preview",
    currentPluginProvider: "",
    textgenWebUIStreamURL: '',
    textgenWebUIBlockingURL: '',
    forceReplaceUrl: '',
    forceReplaceUrl2: '',
    promptPreprocess: false,
    proxyKey: '',
    bias: [],
    ooba: safeStructuredClone(defaultOoba),
    ainconfig: safeStructuredClone(defaultAIN),
    reverseProxyOobaArgs: {
        mode: 'instruct'
    },
    top_p: 1,
    useInstructPrompt: false,
    verbosity: 1
}

const defaultSdData:[string,string][] = [
    ["always", "solo, 1girl"],
    ['negative', ''],
    ["|character\'s appearance", ''],
    ['current situation', ''],
    ['$character\'s pose', ''],
    ['$character\'s emotion', ''],
    ['current location', ''],
]

export const defaultSdDataFunc = () =>{
    return safeStructuredClone(defaultSdData)
}



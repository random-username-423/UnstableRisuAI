import type { OobaSettings, AINsettings, DynamicOutput, SeparateParameters, customscript } from './settings';
import type { NAISettings } from '../../../process/models/nai';
import type { PromptItem, PromptSettings } from '../../../process/utils/prompt';
import type { OobaChatCompletionRequestParams } from '../../../model/ooba';
import type { LLMFormat, LLMFlags } from '../../../model/types';

export type FormatingOrderItem = 'main'|'jailbreak'|'chats'|'lorebook'|'globalNote'|'authorNote'|'lastChat'|'description'|'postEverything'|'personaPrompt'

export interface botPreset{
    name?:string
    openAIKey?: string
    mainPrompt: string
    jailbreak: string
    globalNote:string
    temperature: number
    maxContext: number
    maxResponse: number
    frequencyPenalty: number
    PresensePenalty: number
    formatingOrder: FormatingOrderItem[]
    aiModel?: string
    subModel?:string
    currentPluginProvider?:string
    textgenWebUIStreamURL?:string
    textgenWebUIBlockingURL?:string
    forceReplaceUrl?:string
    promptPreprocess: boolean,
    bias: [string, number][]
    proxyRequestModel?:string
    openrouterRequestModel?:string
    proxyKey?:string
    ooba: OobaSettings
    ainconfig: AINsettings
    koboldURL?: string
    NAISettings?: NAISettings
    autoSuggestPrompt?: string
    autoSuggestPrefix?: string
    autoSuggestClean?: boolean
    promptTemplate?:PromptItem[]
    NAIadventure?: boolean
    NAIappendName?: boolean
    localStopStrings?: string[]
    customProxyRequestModel?: string
    reverseProxyOobaArgs?: OobaChatCompletionRequestParams
    top_p?: number
    promptSettings?: PromptSettings
    repetition_penalty?:number
    min_p?:number
    top_a?:number
    openrouterProvider?:string
    useInstructPrompt?:boolean
    customPromptTemplateToggle?:string
    templateDefaultVariables?:string
    moduleIntergration?:string
    top_k?:number
    instructChatTemplate?:string
    JinjaTemplate?:string
    jsonSchemaEnabled?:boolean
    jsonSchema?:string
    strictJsonSchema?:boolean
    extractJson?:string
    groupTemplate?:string
    groupOtherBotRole?:string
    seperateParametersEnabled?:boolean
    seperateParameters?:{
        memory: SeparateParameters,
        emotion: SeparateParameters,
        translate: SeparateParameters,
        otherAx: SeparateParameters
    }
    customAPIFormat?:LLMFormat
    systemContentReplacement?: string
    systemRoleReplacement?: 'user'|'assistant'
    openAIPrediction?: string
    enableCustomFlags?: boolean
    customFlags?: LLMFlags[]
    image?:string
    regex?:customscript[]
    reasonEffort?:number
    thinkingTokens?:number
    thinkingLevel?:number
    pastThinkingSend?:number
    pastThinkingExtraTokens?:number
    outputImageModal?:boolean
    seperateModelsForAxModels?:boolean
    seperateModels?:{
        memory: string
        emotion: string
        translate: string
        otherAx: string
    }
    modelTools?:string[]
    fallbackModels?: {
        memory: string[],
        emotion: string[],
        translate: string[],
        otherAx: string[]
        model: string[]
    }
    fallbackWhenBlankResponse?: boolean
    verbosity?:number
    dynamicOutput?:DynamicOutput
}

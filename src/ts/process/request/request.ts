import { language } from "../../../lang";
import { getCurrentCharacter, getCurrentChat, getDatabase } from "../../data/storage/database.svelte";
import { getModelInfo, LLMFormat } from "../../model/modellist";
import { risuEscape, risuUnescape } from "../../utils/parser.svelte";
import { pluginV2 } from "../../plugins/plugins";
import { sleep } from '../../utils/util';
import { getTools } from "../mcp/mcp";
import { runTrigger } from "../triggers";

// Import from split files
import type {
    ToolCall,
    requestDataArgument,
    RequestDataArgumentExtended,
    requestDataResponse,
    StreamResponseChunk,
    Parameter,
    ModelModeExtended,
    OpenAITextContents,
    OpenAIImageContents,
    OpenAIContents,
    OpenAIToolCall,
    OpenAIChatExtra,
    KoboldSamplerSettingsSchema,
    KoboldGenerationInputSchema,
} from "./types";
import { applyParameters, reformater, setObjectValue } from "./utils";
import { requestClaude } from './anthropic';
import { requestGoogleCloudVertex } from './google';
import { requestOpenAI, requestOpenAILegacyInstruct, requestOpenAIResponseAPI } from "./openAI";
import { requestNovelAI } from "./novelai";
import { requestOoba, requestOobaLegacy, requestKobold } from "./textgen";
import { requestOllama } from "./ollama";
import { requestCohere } from "./cohere";
import { requestHorde } from "./horde";
import { requestNovelList, requestPlugin, requestWebLLM } from "./others";

// Re-export types for backward compatibility
export type {
    ToolCall,
    requestDataArgument,
    RequestDataArgumentExtended,
    requestDataResponse,
    StreamResponseChunk,
    Parameter,
    ModelModeExtended,
    OpenAITextContents,
    OpenAIImageContents,
    OpenAIContents,
    OpenAIToolCall,
    OpenAIChatExtra,
    KoboldSamplerSettingsSchema,
    KoboldGenerationInputSchema,
};

// Re-export utilities for backward compatibility
export { applyParameters, reformater, setObjectValue };

export async function requestChatData(arg:requestDataArgument, model:ModelModeExtended, abortSignal:AbortSignal=null):Promise<requestDataResponse> {
    const db = getDatabase()
    const fallBackModels:string[] = safeStructuredClone(db?.fallbackModels?.[model] ?? [])
    const tools = await getTools()
    fallBackModels.push('')
    let da:requestDataResponse

    if(arg.escape){
        arg.useStreaming = false
        console.warn('Escape is enabled, disabling streaming')
    }

    const originalFormated = safeStructuredClone(arg.formated).map(m => {
        m.content = risuUnescape(m.content)
        return m
    })

    for(let fallbackIndex=0;fallbackIndex<fallBackModels.length;fallbackIndex++){
        let trys = 0
        arg.formated = safeStructuredClone(originalFormated)

        if(fallbackIndex !== 0 && !fallBackModels[fallbackIndex]){
            continue
        }

        while(true){

            if(abortSignal?.aborted){
                return {
                    type: 'fail',
                    result: 'Aborted'
                }
            }

            if(pluginV2.replacerbeforeRequest.size > 0){
                for(const replacer of pluginV2.replacerbeforeRequest){
                    arg.formated = await replacer(arg.formated, model)
                }
            }

            try{
                const currentChar = getCurrentCharacter()
                if(currentChar?.type !== 'group'){
                    const perf = performance.now()
                    const d = await runTrigger(currentChar, 'request', {
                        chat: getCurrentChat(),
                        displayMode: true,
                        displayData: JSON.stringify(arg.formated)
                    })

                    if(!d){
                        throw new Error('No trigger result')
                    }
                    const got = JSON.parse(d.displayData)
                    if(!got || !Array.isArray(got)){
                        throw new Error('Invalid return')
                    }
                    arg.formated = got
                    console.log('Trigger time', performance.now() - perf)
                }
            }
            catch(e){
                console.error(e)
            }


            da = await requestChatDataMain({
                ...arg,
                staticModel: fallBackModels[fallbackIndex],
                tools: tools,
            }, model, abortSignal)

            if(abortSignal?.aborted){
                return {
                    type: 'fail',
                    result: 'Aborted'
                }
            }

            if(da.type === 'success' && arg.escape){
                da.result = risuEscape(da.result)
            }

            if(da.type === 'success' && pluginV2.replacerafterRequest.size > 0){
                for(const replacer of pluginV2.replacerafterRequest){
                    da.result = await replacer(da.result, model)
                }
            }

            if(da.type === 'success' && db.banCharacterset?.length > 0){
                let failed = false
                for(const set of db.banCharacterset){
                    console.log(set)
                    const checkRegex = new RegExp(`\\p{Script=${set}}`, 'gu')

                    if(checkRegex.test(da.result)){
                        trys += 1
                        failed = true
                        break
                    }
                }

                if(failed){
                    continue
                }
            }

            if(da.type === 'success' && fallbackIndex !== fallBackModels.length-1 && db.fallbackWhenBlankResponse){
                if(da.result.trim() === ''){
                    break
                }
            }

            if(da.type !== 'fail' || da.noRetry){
                return {
                    ...da,
                    model: fallBackModels[fallbackIndex]
                }
            }

            if(da.failByServerError){
                await sleep(1000)
                if(db.antiServerOverloads){
                    trys -= 0.5 // reduce trys by 0.5, so that it will retry twice as much
                }
            }

            trys += 1
            if(trys > db.requestRetrys){
                if(fallbackIndex === fallBackModels.length-1 || da.model === 'custom'){
                    return da
                }
                break
            }
        }
    }


    return da ?? {
        type: 'fail',
        result: "All models failed"
    }
}

export async function requestChatDataMain(arg:requestDataArgument, model:ModelModeExtended, abortSignal:AbortSignal=null):Promise<requestDataResponse> {
    const db = getDatabase()
    const targ:RequestDataArgumentExtended = arg
    targ.formated = safeStructuredClone(arg.formated)
    targ.maxTokens = arg.maxTokens ??db.maxResponse
    targ.temperature = arg.temperature ?? (db.temperature / 100)
    targ.bias = arg.bias
    targ.currentChar = arg.currentChar
    targ.useStreaming = db.useStreaming && arg.useStreaming
    targ.continue = arg.continue ?? false
    targ.biasString = arg.biasString ?? []
    targ.aiModel = arg.staticModel ? arg.staticModel : (model === 'model' ? db.aiModel : db.subModel)
    targ.multiGen = ((db.genTime > 1 && targ.aiModel.startsWith('gpt') && (!arg.continue)) && (!arg.noMultiGen))
    targ.abortSignal = abortSignal
    targ.modelInfo = getModelInfo(targ.aiModel)
    targ.mode = model
    targ.extractJson = arg.extractJson ?? db.extractJson
    if(targ.aiModel === 'reverse_proxy'){
        targ.modelInfo.internalID = db.customProxyRequestModel
        targ.modelInfo.format = db.customAPIFormat
        targ.customURL = db.forceReplaceUrl
        targ.key = db.proxyKey
    }
    if(targ.aiModel.startsWith('xcustom:::')){
        const found = db.customModels.find(m => m.id === targ.aiModel)
        targ.customURL = found?.url
        targ.key = found?.key
    }

    if(db.seperateModelsForAxModels && !arg.staticModel){
        if(db.seperateModels[model]){
            targ.aiModel = db.seperateModels[model]
            targ.modelInfo = getModelInfo(targ.aiModel)
        }
    }

    const format = targ.modelInfo.format

    targ.formated = reformater(targ.formated, targ.modelInfo)

    switch(format){
        case LLMFormat.OpenAICompatible:
        case LLMFormat.Mistral:
            return requestOpenAI(targ)
        case LLMFormat.OpenAILegacyInstruct:
            return requestOpenAILegacyInstruct(targ)
        case LLMFormat.NovelAI:
            return requestNovelAI(targ)
        case LLMFormat.OobaLegacy:
            return requestOobaLegacy(targ)
        case LLMFormat.Plugin:
            return requestPlugin(targ)
        case LLMFormat.Ooba:
            return requestOoba(targ)
        case LLMFormat.VertexAIGemini:
        case LLMFormat.GeminiAPI:
            return requestGoogleCloudVertex(targ)
        case LLMFormat.Kobold:
            return requestKobold(targ)
        case LLMFormat.NovelList:
            return requestNovelList(targ)
        case LLMFormat.Ollama:
            return requestOllama(targ)
        case LLMFormat.Cohere:
            return requestCohere(targ)
        case LLMFormat.Anthropic:
        case LLMFormat.AnthropicLegacy:
        case LLMFormat.AWSBedrockClaude:
            return requestClaude(targ)
        case LLMFormat.Horde:
            return requestHorde(targ)
        case LLMFormat.WebLLM:
            return requestWebLLM(targ)
        case LLMFormat.OpenAIResponseAPI:
            return requestOpenAIResponseAPI(targ)
    }

    return {
        type: 'fail',
        result: (language.errors.unknownModel)
    }
}

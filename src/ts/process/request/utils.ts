import { getDatabase } from "../../data/storage/database.svelte";
import { LLMFlags, type LLMModel } from "../../model/modellist";
import type { OpenAIChat } from "../index.svelte";
import type { ModelModeExtended, Parameter, ParameterMap } from "./types";

export function setObjectValue<T>(obj: T, key: string, value: any): T {
    const splitKey = key.split('.');
    if(splitKey.length > 1){
        const firstKey = splitKey.shift()
        if(!obj[firstKey]){
            obj[firstKey] = {};
        }
        obj[firstKey] = setObjectValue(obj[firstKey], splitKey.join('.'), value);
        return obj;
    }

    obj[key] = value;
    return obj;
}

export function applyParameters(data: { [key: string]: any }, parameters: Parameter[], rename: ParameterMap, ModelMode:ModelModeExtended, arg:{
    ignoreTopKIfZero?:boolean,
    modelId?:string
} = {}): { [key: string]: any } {
    const db = getDatabase()

    function getEffort(effort:number):string|number{
        switch(effort){
            case -1000:{
                return -1000
            }
            case -1:{
                // GPT-5 시리즈만 minimal, GPT-5.1+ 및 기타는 none
                if (arg.modelId?.startsWith('gpt-5') && !arg.modelId?.startsWith('gpt-5.')) {
                    return 'minimal'
                }
                return 'none'
            }
            case 0:{
                return 'low'
            }
            case 1:{
                return 'medium'
            }
            case 2:{
                return 'high'
            }
            default:{
                return 'medium'
            }
        }
    }

    function getVerbosity(verbosity:number):string|number{
        switch(verbosity){
            case -1000:{
                return -1000
            }
            case 0:{
                return 'low'
            }
            case 1:{
                return 'medium'
            }
            case 2:{
                return 'high'
            }
            default:{
                return 'medium'
            }
        }
    }

    function getThinkingLevel(level:number):string|number{
        switch(level){
            case -1000:{
                return -1000
            }
            case 0:{
                return 'low'
            }
            case 1:{
                return 'medium'
            }
            case 2:{
                return 'high'
            }
            default:{
                return -1000
            }
        }
    }

    if(db.seperateParametersEnabled && ModelMode !== 'model'){
        if(ModelMode === 'submodel'){
            ModelMode = 'otherAx'
        }

        for(const parameter of parameters){

            let value:number|string = 0
            if(parameter === 'top_k' && arg.ignoreTopKIfZero && db.seperateParameters[ModelMode][parameter] === 0){
                continue
            }

            switch(parameter){
                case 'temperature':{
                    value = db.seperateParameters[ModelMode].temperature === -1000 ? -1000 : (db.seperateParameters[ModelMode].temperature / 100)
                    break
                }
                case 'top_k':{
                    value = db.seperateParameters[ModelMode].top_k
                    break
                }
                case 'repetition_penalty':{
                    value = db.seperateParameters[ModelMode].repetition_penalty
                    break
                }
                case 'min_p':{
                    value = db.seperateParameters[ModelMode].min_p
                    break
                }
                case 'top_a':{
                    value = db.seperateParameters[ModelMode].top_a
                    break
                }
                case 'top_p':{
                    value = db.seperateParameters[ModelMode].top_p
                    break
                }
                case 'thinking_tokens':{
                    value = db.seperateParameters[ModelMode].thinking_tokens
                    break
                }
                case 'frequency_penalty':{
                    value = db.seperateParameters[ModelMode].frequency_penalty === -1000 ? -1000 : (db.seperateParameters[ModelMode].frequency_penalty / 100)
                    break
                }
                case 'presence_penalty':{
                    value = db.seperateParameters[ModelMode].presence_penalty === -1000 ? -1000 : (db.seperateParameters[ModelMode].presence_penalty / 100)
                    break
                }
                case 'reasoning_effort':{
                    value = getEffort(db.seperateParameters[ModelMode].reasoning_effort)
                    break
                }
                case 'verbosity':{
                    value = getVerbosity(db.seperateParameters[ModelMode].verbosity)
                    break
                }
                case 'thinking_level':{
                    value = getThinkingLevel(db.seperateParameters[ModelMode].thinking_level)
                    break
                }
            }

            if(value === -1000 || value === undefined){
                continue
            }

            data = setObjectValue(data, rename[parameter] ?? parameter, value)
        }
        return data
    }


    for(const parameter of parameters){
        let value:number|string = 0
        if(parameter === 'top_k' && arg.ignoreTopKIfZero && db.top_k === 0){
            continue
        }
        switch(parameter){
            case 'temperature':{
                value = db.temperature === -1000 ? -1000 : (db.temperature / 100)
                break
            }
            case 'top_k':{
                value = db.top_k
                break
            }
            case 'repetition_penalty':{
                value = db.repetition_penalty
                break
            }
            case 'min_p':{
                value = db.min_p
                break
            }
            case 'top_a':{
                value = db.top_a
                break
            }
            case 'top_p':{
                value = db.top_p
                break
            }
            case 'reasoning_effort':{
                value = getEffort(db.reasoningEffort)
                break
            }
            case 'verbosity':{
                value = getVerbosity(db.verbosity)
                break
            }
            case 'frequency_penalty':{
                value = db.frequencyPenalty === -1000 ? -1000 : (db.frequencyPenalty / 100)
                break
            }
            case 'presence_penalty':{
                value = db.PresensePenalty === -1000 ? -1000 : (db.PresensePenalty / 100)
                break
            }
            case 'thinking_tokens':{
                value = db.thinkingTokens
                break
            }
            case 'thinking_level':{
                value = getThinkingLevel(db.thinkingLevel)
                break
            }
        }

        if(value === -1000){
            continue
        }

        data = setObjectValue(data, rename[parameter] ?? parameter, value)
    }
    return data
}

export function reformater(formated:OpenAIChat[], modelInfo:LLMModel|LLMFlags[]){
    const flags = Array.isArray(modelInfo) ? modelInfo : modelInfo.flags
    const db = getDatabase()
    let systemPrompt:OpenAIChat|null = null

    if(!flags.includes(LLMFlags.hasFullSystemPrompt)){
        if(flags.includes(LLMFlags.hasFirstSystemPrompt)){
            while(formated[0].role === 'system'){
                if(systemPrompt){
                    systemPrompt.content += '\n\n' + formated[0].content
                }
                else{
                    systemPrompt = formated[0]
                }
                formated = formated.slice(1)
            }
        }

        for(let i=0;i<formated.length;i++){
            if(formated[i].role === 'system'){
                formated[i].content = db.systemContentReplacement ? db.systemContentReplacement.replace('{{slot}}', formated[i].content) : `system: ${formated[i].content}`
                formated[i].role = db.systemRoleReplacement
            }
        }
    }

    if(flags.includes(LLMFlags.requiresAlternateRole)){
        let newFormated:OpenAIChat[] = []
        for(let i=0;i<formated.length;i++){
            const m = formated[i]
            if(newFormated.length === 0){
                newFormated.push(m)
                continue
            }

            if(newFormated[newFormated.length-1].role === m.role){

                newFormated[newFormated.length-1].content += '\n' + m.content

                if(m.multimodals){
                    if(!newFormated[newFormated.length-1].multimodals){
                        newFormated[newFormated.length-1].multimodals = []
                    }
                    newFormated[newFormated.length-1].multimodals.push(...m.multimodals)
                }

                if(m.thoughts){
                    if(!newFormated[newFormated.length-1].thoughts){
                        newFormated[newFormated.length-1].thoughts = []
                    }
                    newFormated[newFormated.length-1].thoughts.push(...m.thoughts)
                }

                if(m.cachePoint){
                    if(!newFormated[newFormated.length-1].cachePoint){
                        newFormated[newFormated.length-1].cachePoint = true
                    }
                }

                continue
            }
            else{
                newFormated.push(m)
            }
        }
        formated = newFormated
    }

    if(flags.includes(LLMFlags.mustStartWithUserInput)){
        if(formated.length === 0 || formated[0].role !== 'user'){
            formated.unshift({
                role: 'user',
                content: ' '
            })
        }
    }

    if(systemPrompt){
        formated.unshift(systemPrompt)
    }

    return formated
}

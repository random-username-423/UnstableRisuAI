import type { MultiModal, OpenAIChat } from "../index.svelte";
import type { RPCToolCallContent } from "../mcp/mcplib";

export type ToolCall = {
    name: string;
    arguments: string;
}

export type ToolCallResponse = {
    caller: ToolCall;
    result: RPCToolCallContent[]
}

export interface requestDataArgument {
    formated: OpenAIChat[]
    bias: {[key:number]:number}
    biasString?: [string,number][]
    currentChar?: import("../../data/storage/types").character
    temperature?: number
    maxTokens?:number
    PresensePenalty?: number
    frequencyPenalty?: number,
    useStreaming?:boolean
    isGroupChat?:boolean
    useEmotion?:boolean
    continue?:boolean
    chatId?:string
    noMultiGen?:boolean
    schema?:string
    extractJson?:string
    imageResponse?:boolean
    previewBody?:boolean
    staticModel?: string
    escape?:boolean
    tools?: import("../mcp/mcplib").MCPTool[]
    rememberToolUsage?: boolean
    encryptedThinkingHistory?: {
        provider: string
        data: any
        tokens: number
    }[]
    pastThinkingExtraContext?: boolean
    pastThinkingExtraTokens?: number
}

export interface RequestDataArgumentExtended extends requestDataArgument {
    aiModel?:string
    multiGen?:boolean
    abortSignal?:AbortSignal
    modelInfo?: import("../../model/modellist").LLMModel
    customURL?:string
    mode?:ModelModeExtended
    key?:string
    additionalOutput?:string
}

export type requestDataResponse = {
    type: 'success'|'fail'
    result: string
    noRetry?: boolean,
    special?: {
        emotion?: string
    },
    failByServerError?: boolean
    model?: string
    encryptedThinking?: {
        provider: string
        data: any
        tokens: number
    }
}|{
    type: "streaming",
    result: ReadableStream<StreamResponseChunk>,
    special?: {
        emotion?: string
    }
    model?: string
}|{
    type: "multiline",
    result: ['user'|'char',string][],
    special?: {
        emotion?: string
    }
    model?: string
}

export interface StreamResponseChunk {
    [key:string]: string
}

export type Parameter = 'temperature'|'top_k'|'repetition_penalty'|'min_p'|'top_a'|'top_p'|'frequency_penalty'|'presence_penalty'|'reasoning_effort'|'thinking_tokens'|'thinking_level'|'verbosity'

export type ModelModeExtended = 'model'|'submodel'|'memory'|'emotion'|'otherAx'|'translate'

export type ParameterMap = {
    [key in Parameter]?: string;
};

export interface OpenAITextContents {
    type: 'text'
    text: string
}

export interface OpenAIImageContents {
    type: 'image'|'image_url'
    image_url: {
        url: string
        detail: string
    }
}

export type OpenAIContents = OpenAITextContents|OpenAIImageContents

export interface OpenAIToolCall {
    id:string,
    type:'function',
    function:{
        name:string,
        arguments:string
    },
}

export interface OpenAIChatExtra {
    role: 'system'|'user'|'assistant'|'function'|'developer'|'tool'
    content: string|OpenAIContents[]
    memo?:string
    name?:string
    removable?:boolean
    attr?:string[]
    multimodals?:MultiModal[]
    thoughts?:string[]
    prefix?:boolean
    reasoning_content?:string
    cachePoint?:boolean
    function?: {
        name: string
        description?: string
        parameters: any
        strict: boolean
    }
    tool_call_id?: string
    tool_calls?: OpenAIToolCall[]
}

export interface KoboldSamplerSettingsSchema {
    rep_pen?: number;
    rep_pen_range?: number;
    rep_pen_slope?: number;
    top_k?: number;
    top_a?: number;
    top_p?: number;
    tfs?: number;
    typical?: number;
    temperature?: number;
}

export interface KoboldGenerationInputSchema extends KoboldSamplerSettingsSchema {
    prompt: string;
    use_memory?: boolean;
    use_story?: boolean;
    use_authors_note?: boolean;
    use_world_info?: boolean;
    use_userscripts?: boolean;
    soft_prompt?: string;
    max_length?: number;
    max_context_length?: number;
    n: number;
    disable_output_formatting?: boolean;
    frmttriminc?: boolean;
    frmtrmblln?: boolean;
    frmtrmspch?: boolean;
    singleline?: boolean;
    disable_input_formatting?: boolean;
    frmtadsnsp?: boolean;
    quiet?: boolean;
    sampler_order?: number[];
    sampler_seed?: number;
    sampler_full_determinism?: boolean;
}

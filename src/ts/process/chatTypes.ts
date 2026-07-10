export interface OpenAIChat {
    role: "system" | "user" | "assistant" | "function"
    content: string
    memo?: string
    name?: string
    removable?: boolean
    attr?: string[]
    multimodals?: MultiModal[]
    thoughts?: string[]
    cachePoint?: boolean
    encryptedThinking?: {
        provider: string
        data: any
        tokens: number
    }[]
}

export interface MultiModal {
    type: "image" | "video" | "audio"
    base64: string
    height?: number
    width?: number
}

export interface OpenAIChatFull extends OpenAIChat {
    reasoning?: string
    reasoning_content?: string
    function_call?: {
        name: string
        arguments: string
    }
    tool_calls?: {
        function: {
            name: string
            arguments: string
        }
        id: string
        type: "function"
    }[]
}

export interface requestTokenPart {
    name: string
    tokens: number
}

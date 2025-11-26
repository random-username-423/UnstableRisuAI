import { LLMFlags, LLMFormat, LLMProvider, LLMTokenizer, type LLMModel } from '../types'

const GeminiAPIModels: LLMModel[] = [
    // ===== Gemini 3.0 Series (2025-11) =====
    {
        name: "Gemini Pro 3 Image (Preview)",
        id: 'gemini-3-pro-image-preview',
        provider: LLMProvider.GeminiAPI,
        format: LLMFormat.GeminiAPI,
        flags: [LLMFlags.geminiThinking, LLMFlags.geminiBlockOff, LLMFlags.hasImageInput, LLMFlags.hasImageOutput, LLMFlags.poolSupported, LLMFlags.hasAudioInput, LLMFlags.hasVideoInput, LLMFlags.hasStreaming, LLMFlags.requiresAlternateRole],
        parameters: ['thinking_tokens', 'temperature', 'top_k', 'top_p', 'presence_penalty', 'frequency_penalty'],
        tokenizer: LLMTokenizer.GeminiAPI,
        recommended: true
    },
    {
        name: "Gemini Pro 3 (Preview)",
        id: 'gemini-3-pro-preview',
        provider: LLMProvider.GeminiAPI,
        format: LLMFormat.GeminiAPI,
        flags: [LLMFlags.geminiThinking, LLMFlags.geminiBlockOff, LLMFlags.hasImageInput, LLMFlags.poolSupported, LLMFlags.hasAudioInput, LLMFlags.hasVideoInput, LLMFlags.hasStreaming, LLMFlags.requiresAlternateRole],
        parameters: ['thinking_tokens', 'temperature', 'top_k', 'top_p', 'presence_penalty', 'frequency_penalty'],
        tokenizer: LLMTokenizer.GeminiAPI,
        recommended: true
    },

    // ===== Gemini 2.5 Series (2025-03~09) =====
    {
        name: "Gemini Pro 2.5",
        id: 'gemini-2.5-pro',
        provider: LLMProvider.GeminiAPI,
        format: LLMFormat.GeminiAPI,
        flags: [LLMFlags.hasImageInput, LLMFlags.poolSupported, LLMFlags.hasAudioInput, LLMFlags.hasVideoInput, LLMFlags.hasStreaming, LLMFlags.requiresAlternateRole, LLMFlags.geminiThinking],
        parameters: ['thinking_tokens', 'temperature', 'top_k', 'top_p', 'presence_penalty', 'frequency_penalty'],
        tokenizer: LLMTokenizer.GeminiAPI,
        recommended: true
    },
    {
        name: "Gemini Pro 2.5 Preview (06/05)",
        id: 'gemini-2.5-pro-preview-06-05',
        provider: LLMProvider.GeminiAPI,
        format: LLMFormat.GeminiAPI,
        flags: [LLMFlags.hasImageInput, LLMFlags.poolSupported, LLMFlags.hasAudioInput, LLMFlags.hasVideoInput, LLMFlags.hasStreaming, LLMFlags.requiresAlternateRole, LLMFlags.geminiThinking],
        parameters: ['thinking_tokens', 'temperature', 'top_k', 'top_p', 'presence_penalty', 'frequency_penalty'],
        tokenizer: LLMTokenizer.GeminiAPI,
    },
    {
        name: "Gemini Pro 2.5 Preview (05/06)",
        id: 'gemini-2.5-pro-preview-05-06',
        provider: LLMProvider.GeminiAPI,
        format: LLMFormat.GeminiAPI,
        flags: [LLMFlags.geminiBlockOff, LLMFlags.hasImageInput, LLMFlags.poolSupported, LLMFlags.hasAudioInput, LLMFlags.hasVideoInput, LLMFlags.hasStreaming, LLMFlags.requiresAlternateRole, LLMFlags.geminiThinking],
        parameters: ['thinking_tokens', 'temperature', 'top_k', 'top_p', 'presence_penalty', 'frequency_penalty'],
        tokenizer: LLMTokenizer.GeminiAPI,
    },
    // {
    //     name: "Gemini Pro 2.5 Exp (03/25)",
    //     id: 'gemini-2.5-pro-exp-03-25',
    //     provider: LLMProvider.GeminiAPI,
    //     format: LLMFormat.GeminiAPI,
    //     flags: [LLMFlags.geminiBlockOff, LLMFlags.hasImageInput, LLMFlags.poolSupported, LLMFlags.hasAudioInput, LLMFlags.hasVideoInput, LLMFlags.hasStreaming, LLMFlags.requiresAlternateRole, LLMFlags.geminiThinking],
    //     parameters: ['thinking_tokens', 'temperature', 'top_k', 'top_p', 'presence_penalty', 'frequency_penalty'],
    //     tokenizer: LLMTokenizer.GeminiAPI,
    // },
    // {
    //     name: "Gemini Pro 2.5 Exp",
    //     id: 'gemini-2.5-pro-exp',
    //     provider: LLMProvider.GeminiAPI,
    //     format: LLMFormat.GeminiAPI,
    //     flags: [LLMFlags.geminiThinking, LLMFlags.geminiBlockOff, LLMFlags.hasImageInput, LLMFlags.hasImageOutput, LLMFlags.poolSupported, LLMFlags.hasAudioInput, LLMFlags.hasVideoInput, LLMFlags.hasStreaming, LLMFlags.requiresAlternateRole],
    //     parameters: ['thinking_tokens', 'temperature', 'top_k', 'top_p', 'presence_penalty', 'frequency_penalty'],
    //     tokenizer: LLMTokenizer.GeminiAPI,
    // },
    {
        name: "Gemini Flash 2.5",
        id: 'gemini-2.5-flash',
        provider: LLMProvider.GeminiAPI,
        format: LLMFormat.GeminiAPI,
        flags: [LLMFlags.hasImageInput, LLMFlags.poolSupported, LLMFlags.hasAudioInput, LLMFlags.hasVideoInput, LLMFlags.hasStreaming, LLMFlags.requiresAlternateRole, LLMFlags.geminiThinking],
        parameters: ['thinking_tokens', 'temperature', 'top_k', 'top_p', 'presence_penalty', 'frequency_penalty'],
        tokenizer: LLMTokenizer.GeminiAPI,
        recommended: true
    },
    // {
    //     name: "Gemini Flash 2.5 Preview (05/20)",
    //     id: 'gemini-2.5-flash-preview-05-20',
    //     provider: LLMProvider.GeminiAPI,
    //     format: LLMFormat.GeminiAPI,
    //     flags: [LLMFlags.geminiBlockOff, LLMFlags.hasImageInput, LLMFlags.poolSupported, LLMFlags.hasAudioInput, LLMFlags.hasVideoInput, LLMFlags.hasStreaming, LLMFlags.requiresAlternateRole, LLMFlags.geminiThinking],
    //     parameters: ['thinking_tokens', 'temperature', 'top_k', 'top_p', 'presence_penalty', 'frequency_penalty'],
    //     tokenizer: LLMTokenizer.GeminiAPI,
    // },
    // {
    //     name: "Gemini Flash 2.5 Preview (04/17)",
    //     id: 'gemini-2.5-flash-preview-04-17',
    //     provider: LLMProvider.GeminiAPI,
    //     format: LLMFormat.GeminiAPI,
    //     flags: [LLMFlags.geminiBlockOff, LLMFlags.hasImageInput, LLMFlags.poolSupported, LLMFlags.hasAudioInput, LLMFlags.hasVideoInput, LLMFlags.hasStreaming, LLMFlags.requiresAlternateRole, LLMFlags.geminiThinking],
    //     parameters: ['thinking_tokens', 'temperature', 'top_k', 'top_p', 'presence_penalty', 'frequency_penalty'],
    //     tokenizer: LLMTokenizer.GeminiAPI,
    // },
    {
        name: "Gemini Flash 2.5 Image Preview",
        id: 'gemini-2.5-flash-image-preview',
        provider: LLMProvider.GeminiAPI,
        format: LLMFormat.GeminiAPI,
        flags: [LLMFlags.hasImageInput, LLMFlags.poolSupported, LLMFlags.hasAudioInput, LLMFlags.hasVideoInput, LLMFlags.hasStreaming, LLMFlags.requiresAlternateRole, LLMFlags.hasImageOutput],
        parameters: ['temperature', 'top_k', 'top_p', 'presence_penalty', 'frequency_penalty'],
        tokenizer: LLMTokenizer.GeminiAPI,
    },
    {
        name: "Gemini Flash Lite 2.5",
        id: 'gemini-2.5-flash-lite',
        provider: LLMProvider.GeminiAPI,
        format: LLMFormat.GeminiAPI,
        flags: [LLMFlags.geminiBlockOff, LLMFlags.hasImageInput, LLMFlags.poolSupported, LLMFlags.hasAudioInput, LLMFlags.hasVideoInput, LLMFlags.hasStreaming, LLMFlags.requiresAlternateRole, LLMFlags.geminiThinking],
        parameters: ['thinking_tokens', 'temperature', 'top_k', 'top_p', 'presence_penalty', 'frequency_penalty'],
        tokenizer: LLMTokenizer.GeminiAPI,
    },
    {
        name: "Gemini Flash Lite 2.5 Preview (06/17)",
        id: 'gemini-2.5-flash-lite-preview-06-17',
        provider: LLMProvider.GeminiAPI,
        format: LLMFormat.GeminiAPI,
        flags: [LLMFlags.geminiBlockOff, LLMFlags.hasImageInput, LLMFlags.poolSupported, LLMFlags.hasAudioInput, LLMFlags.hasVideoInput, LLMFlags.hasStreaming, LLMFlags.requiresAlternateRole, LLMFlags.geminiThinking],
        parameters: ['thinking_tokens', 'temperature', 'top_k', 'top_p', 'presence_penalty', 'frequency_penalty'],
        tokenizer: LLMTokenizer.GeminiAPI,
    },

    // ===== Gemini 2.0 Series (2024-12 ~ 2025-02) =====
    {
        name: "Gemini Flash 2.0",
        id: 'gemini-2.0-flash',
        provider: LLMProvider.GeminiAPI,
        format: LLMFormat.GeminiAPI,
        flags: [LLMFlags.geminiBlockOff, LLMFlags.hasImageInput, LLMFlags.hasFirstSystemPrompt, LLMFlags.poolSupported, LLMFlags.hasAudioInput, LLMFlags.hasVideoInput, LLMFlags.hasStreaming, LLMFlags.requiresAlternateRole],
        parameters: ['temperature', 'top_k', 'top_p', 'presence_penalty', 'frequency_penalty'],
        tokenizer: LLMTokenizer.GeminiAPI,
        recommended: false
    },
    {
        name: "Gemini Flash 2.0 Exp",
        id: 'gemini-2.0-flash-exp',
        provider: LLMProvider.GeminiAPI,
        format: LLMFormat.GeminiAPI,
        flags: [LLMFlags.geminiBlockOff, LLMFlags.hasImageInput, LLMFlags.hasImageOutput, LLMFlags.poolSupported, LLMFlags.hasAudioInput, LLMFlags.hasVideoInput, LLMFlags.hasStreaming, LLMFlags.requiresAlternateRole],
        parameters: ['temperature', 'top_k', 'top_p', 'presence_penalty', 'frequency_penalty'],
        tokenizer: LLMTokenizer.GeminiAPI,
    },
    {
        name: "Gemini Flash 2.0 Thinking Exp 0121",
        id: 'gemini-2.0-flash-thinking-exp-01-21',
        provider: LLMProvider.GeminiAPI,
        format: LLMFormat.GeminiAPI,
        flags: [LLMFlags.geminiThinking, LLMFlags.hasImageInput, LLMFlags.hasFirstSystemPrompt, LLMFlags.poolSupported, LLMFlags.hasAudioInput, LLMFlags.hasVideoInput, LLMFlags.hasStreaming, LLMFlags.geminiThinking, LLMFlags.requiresAlternateRole],
        parameters: ['thinking_tokens', 'temperature', 'top_k', 'top_p', 'presence_penalty', 'frequency_penalty'],
        tokenizer: LLMTokenizer.GeminiAPI,
        recommended: false
    },
    {
        name: "Gemini Flash 2.0 Thinking Exp 1219",
        id: 'gemini-2.0-flash-thinking-exp-1219',
        provider: LLMProvider.GeminiAPI,
        format: LLMFormat.GeminiAPI,
        flags: [LLMFlags.hasImageInput, LLMFlags.hasFirstSystemPrompt, LLMFlags.poolSupported, LLMFlags.hasAudioInput, LLMFlags.hasVideoInput, LLMFlags.hasStreaming, LLMFlags.geminiThinking, LLMFlags.requiresAlternateRole],
        parameters: ['thinking_tokens', 'temperature', 'top_k', 'top_p', 'presence_penalty', 'frequency_penalty'],
        tokenizer: LLMTokenizer.GeminiAPI,
    },
    {
        name: "Gemini Flash Lite Preview 2.0 0205",
        id: 'gemini-2.0-flash-lite-preview-02-05',
        provider: LLMProvider.GeminiAPI,
        format: LLMFormat.GeminiAPI,
        flags: [LLMFlags.geminiBlockOff, LLMFlags.hasImageInput, LLMFlags.hasFirstSystemPrompt, LLMFlags.poolSupported, LLMFlags.hasAudioInput, LLMFlags.hasVideoInput, LLMFlags.hasStreaming, LLMFlags.requiresAlternateRole, LLMFlags.noCivilIntegrity],
        parameters: ['temperature', 'top_k', 'top_p', 'presence_penalty', 'frequency_penalty'],
        tokenizer: LLMTokenizer.GeminiAPI,
        recommended: false
    },
    // {
    //     name: "Gemini Pro 2.0 Exp 0128",
    //     id: 'gemini-2.0-pro-exp-01-28',
    //     provider: LLMProvider.GeminiAPI,
    //     format: LLMFormat.GeminiAPI,
    //     flags: [LLMFlags.geminiBlockOff, LLMFlags.hasImageInput, LLMFlags.hasFirstSystemPrompt, LLMFlags.poolSupported, LLMFlags.hasAudioInput, LLMFlags.hasVideoInput, LLMFlags.hasStreaming, LLMFlags.requiresAlternateRole],
    //     parameters: ['temperature', 'top_k', 'top_p', 'presence_penalty', 'frequency_penalty'],
    //     tokenizer: LLMTokenizer.GeminiAPI,
    // },
    // {
    //     name: "Gemini Pro 2.0 Exp",
    //     id: 'gemini-2.0-pro-exp',
    //     provider: LLMProvider.GeminiAPI,
    //     format: LLMFormat.GeminiAPI,
    //     flags: [LLMFlags.geminiBlockOff, LLMFlags.hasImageInput, LLMFlags.hasFirstSystemPrompt, LLMFlags.poolSupported, LLMFlags.hasAudioInput, LLMFlags.hasVideoInput, LLMFlags.hasStreaming, LLMFlags.requiresAlternateRole, LLMFlags.noCivilIntegrity],
    //     parameters: ['temperature', 'top_k', 'top_p', 'presence_penalty', 'frequency_penalty'],
    //     tokenizer: LLMTokenizer.GeminiAPI,
    //     recommended: false
    // },

    // ===== Gemini 1.5 Series (2024) =====
    // {
    //     name: "Gemini Pro 1.5",
    //     id: 'gemini-1.5-pro-latest',
    //     provider: LLMProvider.GeminiAPI,
    //     format: LLMFormat.GeminiAPI,
    //     flags: [LLMFlags.hasImageInput, LLMFlags.hasFirstSystemPrompt, LLMFlags.hasStreaming, LLMFlags.hasStreaming, LLMFlags.requiresAlternateRole],
    //     parameters: ['temperature', 'top_k', 'top_p'],
    //     tokenizer: LLMTokenizer.GeminiAPI
    // },
    // {
    //     name: "Gemini Pro 1.5 002",
    //     id: 'gemini-1.5-pro-002',
    //     provider: LLMProvider.GeminiAPI,
    //     format: LLMFormat.GeminiAPI,
    //     flags: [LLMFlags.hasImageInput, LLMFlags.hasFirstSystemPrompt, LLMFlags.hasStreaming, LLMFlags.requiresAlternateRole],
    //     parameters: ['temperature', 'top_k', 'top_p'],
    //     tokenizer: LLMTokenizer.GeminiAPI
    // },
    // {
    //     name: "Gemini Pro 1.5 0827",
    //     id: 'gemini-1.5-pro-exp-0827',
    //     provider: LLMProvider.GeminiAPI,
    //     format: LLMFormat.GeminiAPI,
    //     flags: [LLMFlags.hasImageInput, LLMFlags.hasFirstSystemPrompt, LLMFlags.requiresAlternateRole],
    //     parameters: ['temperature', 'top_k', 'top_p'],
    //     tokenizer: LLMTokenizer.GeminiAPI
    // },
    // {
    //     name: "Gemini Flash 1.5",
    //     id: 'gemini-1.5-flash',
    //     provider: LLMProvider.GeminiAPI,
    //     format: LLMFormat.GeminiAPI,
    //     flags: [LLMFlags.hasImageInput, LLMFlags.hasFirstSystemPrompt, LLMFlags.hasStreaming, LLMFlags.requiresAlternateRole],
    //     parameters: ['temperature', 'top_k', 'top_p'],
    //     tokenizer: LLMTokenizer.GeminiAPI
    // },
    // {
    //     name: "Gemini Flash 1.5 002",
    //     id: 'gemini-1.5-flash-002',
    //     provider: LLMProvider.GeminiAPI,
    //     format: LLMFormat.GeminiAPI,
    //     flags: [LLMFlags.hasImageInput, LLMFlags.hasFirstSystemPrompt, LLMFlags.hasStreaming, LLMFlags.requiresAlternateRole],
    //     parameters: ['temperature', 'top_k', 'top_p'],
    //     tokenizer: LLMTokenizer.GeminiAPI
    // },

    // ===== Gemini 1.0 / Legacy =====
    // {
    //     name: "Gemini Pro",
    //     id: 'gemini-pro',
    //     provider: LLMProvider.GeminiAPI,
    //     format: LLMFormat.GeminiAPI,
    //     flags: [LLMFlags.hasImageInput, LLMFlags.hasFirstSystemPrompt, LLMFlags.hasStreaming, LLMFlags.requiresAlternateRole],
    //     parameters: ['temperature', 'top_k', 'top_p'],
    //     tokenizer: LLMTokenizer.GeminiAPI
    // },
    // {
    //     name: "Gemini Pro Vision",
    //     id: 'gemini-pro-vision',
    //     provider: LLMProvider.GeminiAPI,
    //     format: LLMFormat.GeminiAPI,
    //     flags: [LLMFlags.hasImageInput, LLMFlags.hasFirstSystemPrompt, LLMFlags.hasStreaming, LLMFlags.requiresAlternateRole],
    //     parameters: ['temperature', 'top_k', 'top_p'],
    //     tokenizer: LLMTokenizer.GeminiAPI
    // },
    // {
    //     name: "Gemini Ultra",
    //     id: 'gemini-ultra',
    //     provider: LLMProvider.GeminiAPI,
    //     format: LLMFormat.GeminiAPI,
    //     flags: [LLMFlags.hasImageInput, LLMFlags.hasFirstSystemPrompt, LLMFlags.hasStreaming, LLMFlags.requiresAlternateRole],
    //     parameters: ['temperature', 'top_k', 'top_p'],
    //     tokenizer: LLMTokenizer.GeminiAPI
    // },
    // {
    //     name: "Gemini Ultra Vision",
    //     id: 'gemini-ultra-vision',
    //     provider: LLMProvider.GeminiAPI,
    //     format: LLMFormat.GeminiAPI,
    //     flags: [LLMFlags.hasImageInput, LLMFlags.hasFirstSystemPrompt, LLMFlags.hasStreaming, LLMFlags.requiresAlternateRole],
    //     parameters: ['temperature', 'top_k', 'top_p'],
    //     tokenizer: LLMTokenizer.GeminiAPI
    // },

    // ===== Experimental =====
    // {
    //     name: "Gemini Exp 1206",
    //     id: 'gemini-exp-1206',
    //     provider: LLMProvider.GeminiAPI,
    //     format: LLMFormat.GeminiAPI,
    //     flags: [LLMFlags.hasImageInput, LLMFlags.hasFirstSystemPrompt, LLMFlags.poolSupported, LLMFlags.hasStreaming, LLMFlags.requiresAlternateRole],
    //     parameters: ['temperature', 'top_k', 'top_p'],
    //     tokenizer: LLMTokenizer.GeminiAPI
    // },
    // {
    //     name: "Gemini Exp 1121",
    //     id: 'gemini-exp-1121',
    //     provider: LLMProvider.GeminiAPI,
    //     format: LLMFormat.GeminiAPI,
    //     flags: [LLMFlags.hasImageInput, LLMFlags.hasFirstSystemPrompt, LLMFlags.poolSupported, LLMFlags.hasStreaming, LLMFlags.requiresAlternateRole],
    //     parameters: ['temperature', 'top_k', 'top_p'],
    //     tokenizer: LLMTokenizer.GeminiAPI,
    // },
    // {
    //     name: "Gemini Exp 1114",
    //     id: 'gemini-exp-1114',
    //     provider: LLMProvider.GeminiAPI,
    //     format: LLMFormat.GeminiAPI,
    //     flags: [LLMFlags.hasImageInput, LLMFlags.hasFirstSystemPrompt, LLMFlags.hasStreaming, LLMFlags.requiresAlternateRole],
    //     parameters: ['temperature', 'top_k', 'top_p'],
    //     tokenizer: LLMTokenizer.GeminiAPI
    // },
]

// Generate Vertex AI variants from Gemini API models
const VertexAIModels: LLMModel[] = GeminiAPIModels.map(model => ({
    ...model,
    id: `${model.id}-vertex`,
    name: `${model.name} Vertex`,
    provider: LLMProvider.VertexAI,
    format: LLMFormat.VertexAIGemini,
    recommended: model.recommended
}))

// Export both: Gemini API first, then Vertex AI
export const GoogleModels: LLMModel[] = [
    ...GeminiAPIModels,
    ...VertexAIModels
]

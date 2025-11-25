import { LLMFlags, LLMFormat, LLMProvider, LLMTokenizer, type LLMModel } from '../types'

export const DeepSeekModels: LLMModel[] = [
    // ===== DeepSeek V3.2 Series (2025-09) =====
    {
        id: 'deepseek-v3.2-exp',
        internalID: 'deepseek-chat',
        name: 'DeepSeek V3.2 Exp',
        provider: LLMProvider.DeepSeek,
        format: LLMFormat.OpenAICompatible,
        flags: [LLMFlags.hasFirstSystemPrompt, LLMFlags.requiresAlternateRole, LLMFlags.mustStartWithUserInput, LLMFlags.hasPrefill, LLMFlags.deepSeekPrefix, LLMFlags.hasStreaming],
        parameters: ['frequency_penalty', 'presence_penalty', 'temperature', 'top_p'],
        tokenizer: LLMTokenizer.DeepSeek,
        endpoint: 'https://api.deepseek.com/beta/chat/completions',
        keyIdentifier: 'deepseek',
        recommended: true
    },

    // ===== DeepSeek V3.1 Series (2025-08) =====
    {
        id: 'deepseek-v3.1',
        internalID: 'deepseek-chat',
        name: 'DeepSeek V3.1',
        provider: LLMProvider.DeepSeek,
        format: LLMFormat.OpenAICompatible,
        flags: [LLMFlags.hasFirstSystemPrompt, LLMFlags.requiresAlternateRole, LLMFlags.mustStartWithUserInput, LLMFlags.hasPrefill, LLMFlags.deepSeekPrefix, LLMFlags.hasStreaming],
        parameters: ['frequency_penalty', 'presence_penalty', 'temperature', 'top_p'],
        tokenizer: LLMTokenizer.DeepSeek,
        endpoint: 'https://api.deepseek.com/beta/chat/completions',
        keyIdentifier: 'deepseek'
    },

    // ===== DeepSeek R1 Series (2025-01~05) =====
    {
        id: 'deepseek-r1-0528',
        internalID: 'deepseek-reasoner',
        name: 'DeepSeek R1 (0528)',
        provider: LLMProvider.DeepSeek,
        format: LLMFormat.OpenAICompatible,
        flags: [LLMFlags.hasFirstSystemPrompt, LLMFlags.requiresAlternateRole, LLMFlags.mustStartWithUserInput, LLMFlags.hasPrefill, LLMFlags.deepSeekPrefix, LLMFlags.deepSeekThinkingInput, LLMFlags.hasStreaming],
        parameters: [],
        tokenizer: LLMTokenizer.DeepSeek,
        endpoint: 'https://api.deepseek.com/beta/chat/completions',
        keyIdentifier: 'deepseek',
        recommended: true
    },

    // ===== DeepSeek Latest (Aliases) =====
    {
        id: 'deepseek-chat',
        name: 'DeepSeek Chat',
        provider: LLMProvider.DeepSeek,
        format: LLMFormat.OpenAICompatible,
        flags: [LLMFlags.hasFirstSystemPrompt, LLMFlags.requiresAlternateRole, LLMFlags.mustStartWithUserInput, LLMFlags.hasPrefill, LLMFlags.deepSeekPrefix, LLMFlags.hasStreaming],
        parameters: ['frequency_penalty', 'presence_penalty', 'temperature', 'top_p'],
        tokenizer: LLMTokenizer.DeepSeek,
        endpoint: 'https://api.deepseek.com/beta/chat/completions',
        keyIdentifier: 'deepseek',
        recommended: true
    },
    {
        id: 'deepseek-reasoner',
        name: 'DeepSeek Reasoner',
        provider: LLMProvider.DeepSeek,
        format: LLMFormat.OpenAICompatible,
        flags: [LLMFlags.hasFirstSystemPrompt, LLMFlags.requiresAlternateRole, LLMFlags.mustStartWithUserInput, LLMFlags.hasPrefill, LLMFlags.deepSeekPrefix, LLMFlags.deepSeekThinkingInput, LLMFlags.hasStreaming],
        parameters: [],
        tokenizer: LLMTokenizer.DeepSeek,
        endpoint: 'https://api.deepseek.com/beta/chat/completions',
        keyIdentifier: 'deepseek',
        recommended: true
    },
]

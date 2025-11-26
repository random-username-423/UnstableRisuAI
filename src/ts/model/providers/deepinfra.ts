import { LLMFlags, LLMFormat, LLMProvider, LLMTokenizer, type LLMModel } from '../types'

function makeDeepInfraModels(ids: string[]): LLMModel[] {
    return ids.map((id) => {
        return {
            id: 'deepinfra_' + id,
            name: id,
            internalID: id,
            provider: LLMProvider.DeepInfra,
            format: LLMFormat.OpenAICompatible,
            parameters: ['frequency_penalty', 'presence_penalty', 'temperature', 'top_p'],
            flags: [LLMFlags.hasFirstSystemPrompt, LLMFlags.requiresAlternateRole, LLMFlags.mustStartWithUserInput, LLMFlags.hasPrefill, LLMFlags.deepSeekThinkingOutput, LLMFlags.hasStreaming],
            tokenizer: LLMTokenizer.DeepSeek,
            endpoint: 'https://api.deepinfra.com/v1/openai/chat/completions',
            keyIdentifier: 'deepinfra',
        } as LLMModel
    })
}

export const DeepInfraModels: LLMModel[] = makeDeepInfraModels([
    // ===== Llama 4 Series (2025) =====
    'meta-llama/Llama-4-Maverick-17B-128E-Instruct',
    'meta-llama/Llama-4-Scout-17B-16E-Instruct',

    // ===== Qwen3 Series (2025) =====
    'Qwen/Qwen3-235B-A22B-Instruct',
    'Qwen/Qwen3-32B',
    'Qwen/Qwen3-30B-A3B',
    'Qwen/Qwen3-Coder-480B-A35B-Instruct',

    // ===== DeepSeek Series (2025) =====
    'deepseek-ai/DeepSeek-V3.1',
    'deepseek-ai/DeepSeek-R1',
    'deepseek-ai/DeepSeek-R1-Distill-Llama-70B',
    'deepseek-ai/DeepSeek-V3',

    // ===== Llama 3.3 Series (2024) =====
    'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    'meta-llama/Llama-3.3-70B-Instruct',

    // ===== Llama 3.2 Series (2024) =====
    'meta-llama/Llama-3.2-90B-Vision-Instruct',
    'meta-llama/Llama-3.2-11B-Vision-Instruct',

    // ===== Llama 3.1 Series (2024) =====
    'meta-llama/Meta-Llama-3.1-405B-Instruct',
    'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
    'meta-llama/Meta-Llama-3.1-70B-Instruct',
    'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
    'meta-llama/Meta-Llama-3.1-8B-Instruct',
    'nvidia/Llama-3.1-Nemotron-70B-Instruct',

    // ===== Qwen2.5 Series (2024) =====
    'Qwen/Qwen2.5-72B-Instruct',
    'Qwen/Qwen2.5-Coder-32B-Instruct',
    'Qwen/QwQ-32B-Preview',

    // ===== Microsoft (2024-2025) =====
    'microsoft/phi-4',
    'microsoft/WizardLM-2-8x22B',

    // ===== Google Gemma (2024) =====
    'google/gemma-2-27b-it',
    'google/gemma-2-9b-it',

    // ===== RP/Creative Models =====
    'Sao10K/L3.3-70B-Euryale-v2.3',
    'Sao10K/L3.1-70B-Euryale-v2.2',
    'Sao10K/L3-70B-Euryale-v2.1',
    'Gryphe/MythoMax-L2-13b',
    'Gryphe/MythoMax-L2-13b-turbo',
    'Austism/chronos-hermes-13b-v2',

    // ===== Other =====
    '01-ai/Yi-34B-Chat',
])

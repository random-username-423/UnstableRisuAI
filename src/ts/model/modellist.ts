// Re-export types
export * from './types'

// Provider names that should have a separator line AFTER them in the model list UI
// Categories: Proprietary APIs | Open-source APIs | Local | Others
export const ProviderSeparatorAfter = new Set([
    'Vertex AI',      // End of proprietary models
    'Cohere',         // End of open-source APIs
    'Horde',          // End of local models
])

import { getDatabase } from "../storage/database.svelte"
import {
    LLMFlags,
    LLMFormat,
    LLMProvider,
    LLMTokenizer,
    OpenAIParameters,
    ProviderNames,
    type LLMModel
} from './types'

// Import models from provider files
import { OpenAIModels } from './providers/openai'
import { AnthropicModels } from './providers/anthropic'
import { AWSModels } from './providers/aws'
import { GoogleModels } from './providers/google'
import { MistralModels } from './providers/mistral'
import { CohereModels } from './providers/cohere'
import { NovelAIModels } from './providers/novelai'
import { DeepSeekModels } from './providers/deepseek'
import { DeepInfraModels } from './providers/deepinfra'
import { OtherModels } from './providers/others'

// Combine all models
export const LLMModels: LLMModel[] = [
    ...OpenAIModels,
    ...AnthropicModels,
    ...AWSModels,
    ...GoogleModels,
    ...OtherModels.slice(2, 3), // OpenRouter
    ...OtherModels.slice(1, 2), // Mancer
    ...DeepInfraModels,
    ...DeepSeekModels,
    ...MistralModels,
    ...CohereModels,
    ...OtherModels.slice(0, 1), // Ooba
    ...OtherModels.slice(3, 4), // Kobold
    ...OtherModels.slice(6, 9), // WebLLM models
    ...OtherModels.slice(4, 6), // Ollama, Horde
    ...NovelAIModels,
    ...OtherModels.slice(9), // Plugin, Custom API
]

// Post-processing: fill in default values
for (let model of LLMModels) {
    model.shortName ??= model.name
    model.internalID ??= model.id
    model.fullName ??= model.provider !== LLMProvider.AsIs ? `${ProviderNames.get(model.provider) ?? ''} ${model.name}`.trim() : model.name
}

// Add Response API variants for OpenAI models
for (let i = 0; i < LLMModels.length; i++) {
    if (LLMModels[i].provider === LLMProvider.OpenAI && LLMModels[i].format === LLMFormat.OpenAICompatible) {
        LLMModels.push({
            ...LLMModels[i],
            format: LLMFormat.OpenAIResponseAPI,
            flags: [...LLMModels[i].flags, LLMFlags.hasPrefill],
            id: `${LLMModels[i].id}-response-api`,
            name: `${LLMModels[i].name} (Response API)`,
            fullName: `${LLMModels[i].fullName ?? LLMModels[i].name} (Response API)`,
            recommended: false
        })
    }
}

export function getModelInfo(id: string): LLMModel {
    const db = getDatabase()
    const found: LLMModel = safeStructuredClone(LLMModels.find(model => model.id === id))

    if (found) {
        if (db.enableCustomFlags) {
            found.flags = db.customFlags
        }
        return found
    }

    if (id.startsWith('hf:::')) {
        const withoutPrefix = id.replace('hf:::', '')
        return {
            id,
            name: withoutPrefix,
            shortName: withoutPrefix,
            fullName: withoutPrefix,
            internalID: withoutPrefix,
            provider: LLMProvider.WebLLM,
            format: LLMFormat.WebLLM,
            flags: [],
            parameters: OpenAIParameters,
            tokenizer: LLMTokenizer.Local
        }
    }
    if (id.startsWith('horde:::')) {
        const withoutPrefix = id.replace('horde:::', '')
        return {
            id,
            name: withoutPrefix,
            shortName: withoutPrefix,
            fullName: withoutPrefix,
            internalID: withoutPrefix,
            provider: LLMProvider.Horde,
            format: LLMFormat.Horde,
            flags: [],
            parameters: OpenAIParameters,
            tokenizer: LLMTokenizer.Unknown
        }
    }
    if (id.startsWith('xcustom:::')) {
        const customModels = db?.customModels || []
        const found = customModels.find((model) => model.id === id)
        if (found) {
            return {
                id: found.id,
                name: found.name,
                shortName: found.name,
                fullName: found.name,
                internalID: found.internalId,
                provider: LLMProvider.AsIs,
                format: found.format,
                flags: found.flags,
                parameters: ['temperature', 'top_p', 'frequency_penalty', 'presence_penalty', 'repetition_penalty', 'min_p', 'top_a', 'top_k', 'thinking_tokens'],
                tokenizer: found.tokenizer
            }
        }
    }

    return {
        id,
        name: id,
        shortName: id,
        fullName: id,
        internalID: id,
        provider: LLMProvider.AsIs,
        format: LLMFormat.OpenAICompatible,
        flags: [],
        parameters: OpenAIParameters,
        tokenizer: LLMTokenizer.Unknown
    }
}

interface GetModelListGroup {
    providerName: string
    models: LLMModel[]
}

export function getModelList<T extends boolean>(arg: {
    recommendedOnly?: boolean,
    groupedByProvider?: T
} = {}): T extends true ? GetModelListGroup[] : LLMModel[] {
    let models = LLMModels
    if (arg.recommendedOnly) {
        models = models.filter(model => model.recommended)
    }
    if (arg.groupedByProvider) {
        let group: GetModelListGroup[] = []
        for (let model of models) {
            if (model.provider === LLMProvider.AsIs) {
                group.push({
                    providerName: '@as-is',
                    models: [model]
                })
                continue
            }

            let providerName = ProviderNames.get(model.provider) || 'Unknown'
            let groupIndex = group.findIndex(g => g.providerName === providerName)
            if (groupIndex === -1) {
                group.push({
                    providerName,
                    models: [model]
                })
            } else {
                group[groupIndex].models.push(model)
            }
        }
        return group as any
    }
    return models as any
}

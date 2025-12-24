// Separated from hypav3.ts to avoid circular dependency with database.svelte.ts

export interface SerializableSummary {
    text: string
    chatMemos: string[]
    isImportant: boolean
}

export interface SerializableHypaV3Data {
    summaries: SerializableSummary[]
    lastSelectedSummaries?: number[]
    metrics?: {
        lastImportantSummaries: number[]
        lastRecentSummaries: number[]
        lastSimilarSummaries: number[]
        lastRandomSummaries: number[]
    }
    modalSettings?: {
        displayMode: string
        displayRangeFrom: number
        displayRangeTo: number
        displayRecentCount: number
        displayImportant: boolean
        displaySelected: boolean
    }
}

export interface HypaV3Preset {
    name: string
    settings: HypaV3Settings
}

export interface HypaV3Settings {
    summarizationModel: string
    summarizationPrompt: string
    memoryTokensRatio: number
    extraSummarizationRatio: number
    maxChatsPerSummary: number
    recentMemoryRatio: number
    similarMemoryRatio: number
    enableSimilarityCorrection: boolean
    preserveOrphanedMemory: boolean
    processRegexScript: boolean
    doNotSummarizeUserMessage: boolean
    // Experimental
    useExperimentalImpl: boolean
    summarizationRequestsPerMinute: number
    summarizationMaxConcurrent: number
    embeddingRequestsPerMinute: number
    embeddingMaxConcurrent: number
    alwaysToggleOn: boolean
}

export function createHypaV3Preset(name = "New Preset", existingSettings = {}): HypaV3Preset {
    const settings: HypaV3Settings = {
        summarizationModel: "subModel",
        summarizationPrompt: "",
        memoryTokensRatio: 0.2,
        extraSummarizationRatio: 0,
        maxChatsPerSummary: 6,
        recentMemoryRatio: 0.4,
        similarMemoryRatio: 0.4,
        enableSimilarityCorrection: false,
        preserveOrphanedMemory: false,
        processRegexScript: false,
        doNotSummarizeUserMessage: false,
        // Experimental
        useExperimentalImpl: false,
        summarizationRequestsPerMinute: 20,
        summarizationMaxConcurrent: 1,
        embeddingRequestsPerMinute: 100,
        embeddingMaxConcurrent: 1,
        alwaysToggleOn: false,
    }

    if (existingSettings && typeof existingSettings === "object" && !Array.isArray(existingSettings)) {
        for (const [key, value] of Object.entries(existingSettings)) {
            if (key in settings && typeof value === typeof settings[key]) {
                settings[key] = value
            }
        }
    }

    return {
        name,
        settings,
    }
}

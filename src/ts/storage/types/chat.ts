import type { SerializableHypaV2Data } from 'src/ts/process/memory/hypav2';
import type { SerializableHypaV3Data } from 'src/ts/process/memory/hypav3';
import type { loreBook } from './character';
import type { OpenAIChat } from 'src/ts/process/index.svelte';

export interface Chat {
    message: Message[];
    note: string;
    name: string;
    localLore: loreBook[];
    sdData?: string;
    supaMemoryData?: string;
    hypaV2Data?: SerializableHypaV2Data;
    lastMemory?: string;
    suggestMessages?: string[];
    isStreaming?: boolean;
    scriptstate?: { [key: string]: string | number | boolean; };
    modules?: string[];
    id?: string;
    bindedPersona?: string;
    fmIndex?: number;
    hypaV3Data?: SerializableHypaV3Data;
    folderId?: string;
    lastDate?: number;
    bookmarks?: string[];
    bookmarkNames?: { [chatId: string]: string; };
}

export interface ChatFolder {
    id: string;
    name?: string;
    color?: string;
    folded: boolean;
}

export interface Message{
    role: 'user'|'char'
    data: string
    saying?: string
    chatId?:string
    time?: number
    generationInfo?: MessageGenerationInfo
    promptInfo?: MessagePresetInfo
    name?:string
    otherUser?:boolean
    disabled?:false|true|'allBefore'
    isComment?:boolean
}
export interface MessageGenerationInfo {
    model?: string;
    generationId?: string;
    inputTokens?: number;
    outputTokens?: number;
    maxContext?: number;
    stageTiming?: {
        stage1?: number;
        stage2?: number;
        stage3?: number;
        stage4?: number;
    };
}export interface MessagePresetInfo {
    promptName?: string;
    promptToggles?: { key: string; value: string; }[];
    promptText?: OpenAIChat[];
}


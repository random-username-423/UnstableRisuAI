import type { character, Message, groupChat } from "src/ts/data/storage/types";
import type { OpenAIChat, MultiModal } from "src/ts/process/chatTypes";
import { DBState } from 'src/ts/stores.svelte';
import { ChatTokenizer } from "src/ts/utils/tokenizer";
import { processScriptFull, risuChatParser } from "src/ts/process/scripting/scripts";
import { getInlayAsset } from "src/ts/process/files/inlays";
import { runImageEmbedding } from "src/ts/process/integrations/transformers";
import { getModuleAssets } from "src/ts/process/scripting/modules";
import { readImage } from "src/ts/utils/fileIO";
import { findCharacterbyId, getUserName } from "src/ts/utils/util";
import { getModelInfo } from "src/ts/model/modellist";
import { LLMFlags } from "src/ts/model/types";
import { v4 } from "uuid";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface FormatMessageOptions {
    currentChar: character
    nowChatroom: character | groupChat
    tokenizer: ChatTokenizer
    usingPromptTemplate: boolean
    sendName: boolean
    isGroupChat: boolean
    pastThinkingSend: number  // 0 = None, 1 = Send (include in maxContext), 2 = Send (Extra Context)
    maxThoughtDepth: number   // -1 = unlimited
    groupTemplate: string
    groupOtherBotRole: string
    findCharacterbyIdWithCache: (id: string) => character
}

export interface FormattedMessageResult {
    chat: OpenAIChat
    tokens: number
}

export interface FormattedChatHistoryResult {
    chats: OpenAIChat[]
    totalTokens: number
}

export interface InlayExtractionResult {
    cleanedContent: string
    multimodals: MultiModal[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Inlay Processing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract inlay references from message content and convert to multimodals
 */
export async function extractInlays(
    content: string,
    role: 'user' | 'char',
    currentChar: character
): Promise<InlayExtractionResult> {
    const multimodals: MultiModal[] = []
    let cleanedContent = content
    const modelInfo = getModelInfo(DBState.db.aiModel)

    // Collect inlay references
    const inlays: string[] = []

    if (role === 'char') {
        cleanedContent = cleanedContent.replace(/{{(inlay|inlayed|inlayeddata)::(.+?)}}/g, (
            match: string,
            p1: string,
            p2: string
        ) => {
            if (p2 && p1 === 'inlayeddata') {
                inlays.push(p2)
            }
            return ''
        })
    } else {
        const inlayMatch = cleanedContent.match(/{{(inlay|inlayed|inlayeddata)::(.+?)}}/g)
        if (inlayMatch) {
            for (const inlay of inlayMatch) {
                inlays.push(inlay)
            }
        }
    }

    // Process each inlay
    for (const inlay of inlays) {
        const inlayName = inlay
            .replace('{{inlayed::', '')
            .replace('{{inlay::', '')
            .replace('{{inlayeddata::', '')
            .replace('}}', '')

        const inlayData = await getInlayAsset(inlayName)

        if (inlayData?.type === 'image') {
            if (modelInfo.flags.includes(LLMFlags.hasImageInput)) {
                multimodals.push({
                    type: 'image',
                    base64: inlayData.data,
                    width: inlayData.width,
                    height: inlayData.height
                })
            } else {
                // Fallback to image caption for models without image input
                const captionResult = await runImageEmbedding(inlayData.data)
                cleanedContent += `[${captionResult[0].generated_text}]`
            }
        }

        if (inlayData?.type === 'video' || inlayData?.type === 'audio') {
            if (multimodals.length === 0) {
                multimodals.push({
                    type: inlayData.type,
                    base64: inlayData.data
                })
            }
        }

        cleanedContent = cleanedContent.replace(inlay, '')
    }

    return { cleanedContent, multimodals }
}

/**
 * Process asset prompts ({{asset_prompt::name}}) in message content
 */
export async function processAssetPrompts(
    content: string,
    currentChar: character
): Promise<InlayExtractionResult> {
    const multimodals: MultiModal[] = []
    const assetPromises: Promise<void>[] = []

    const cleanedContent = content.replace(/\{\{asset_?prompt::(.+?)\}\}/gmsiu, (match, p1) => {
        const moduleAssets = getModuleAssets()
        const assets = (currentChar.additionalAssets ?? []).concat(moduleAssets)
        const asset = assets.find(v => v[0] === p1)

        if (asset) {
            assetPromises.push((async () => {
                const assetDataBuf = await readImage(asset[1])
                multimodals.push({
                    type: "image",
                    base64: `data:image/png;base64,${Buffer.from(assetDataBuf).toString('base64')}`
                })
            })())
        } else if (p1 === 'icon') {
            assetPromises.push((async () => {
                const assetDataBuf = await readImage(currentChar.image ?? '')
                multimodals.push({
                    type: "image",
                    base64: `data:image/png;base64,${Buffer.from(assetDataBuf).toString('base64')}`
                })
            })())
        }
        return ''
    })

    await Promise.all(assetPromises)

    return { cleanedContent, multimodals }
}

/**
 * Extract thoughts from message content
 */
export function extractThoughts(
    content: string,
    messageIndex: number,
    totalMessages: number,
    maxThoughtDepth: number
): { cleanedContent: string, thoughts: string[] } {
    const thoughts: string[] = []

    const cleanedContent = content.replace(/<Thoughts>(.+)<\/Thoughts>/gms, (match, p1) => {
        if (maxThoughtDepth === -1 || (maxThoughtDepth - totalMessages) <= messageIndex) {
            thoughts.push(p1)
        }
        return ''
    })

    return { cleanedContent, thoughts }
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determine the speaker name for a message
 */
export function getMessageSpeakerName(
    msg: Message,
    currentChar: character,
    findCharWithCache: (id: string) => character
): string {
    if (msg.role === 'char') {
        if (msg.saying) {
            return findCharWithCache(msg.saying).name
        }
        return currentChar.name
    } else if (msg.role === 'user') {
        return getUserName()
    }
    return ''
}

/**
 * Apply group chat formatting to message content
 */
export function applyGroupFormatting(
    content: string,
    msg: Message,
    currentChar: character,
    options: FormatMessageOptions
): { content: string, role: 'user' | 'assistant' | 'system' } {
    let role: 'user' | 'assistant' | 'system' = msg.role === 'user' ? 'user' : 'assistant'

    const sayingChar = options.findCharacterbyIdWithCache(msg.saying)
    const isOtherCharInGroup = options.isGroupChat && sayingChar.chaId !== currentChar.chaId
    const needsGroupTemplate = isOtherCharInGroup ||
        (options.isGroupChat && options.groupOtherBotRole === 'assistant') ||
        (options.usingPromptTemplate && options.sendName)

    if (needsGroupTemplate) {
        const form = options.groupTemplate || `<{{char}}'s Message>\n{{slot}}\n</{{char}}'s Message>`
        content = risuChatParser(form, { chara: sayingChar.name }).replace('{{slot}}', content)

        switch (options.groupOtherBotRole) {
            case 'user':
            case 'assistant':
            case 'system':
                role = options.groupOtherBotRole as 'user' | 'assistant' | 'system'
                break
            default:
                role = 'assistant'
                break
        }
    }

    return { content, role }
}

/**
 * Format a single message into OpenAIChat format
 */
export async function formatSingleMessage(
    msg: Message,
    index: number,
    totalMessages: number,
    options: FormatMessageOptions
): Promise<FormattedMessageResult> {
    const { currentChar, nowChatroom, tokenizer, pastThinkingSend, maxThoughtDepth } = options

    // Ensure message has chatId
    if (!msg.chatId) {
        msg.chatId = v4()
    }

    // Process script and parse chat variables
    let formatedChat = (await processScriptFull(
        nowChatroom,
        risuChatParser(msg.data, { chara: currentChar, role: msg.role }),
        'editprocess',
        index,
        { chatRole: msg.role }
    )).data

    // Extract thoughts (before extracting inlays)
    const thoughtResult = extractThoughts(formatedChat, index, totalMessages, maxThoughtDepth)
    formatedChat = thoughtResult.cleanedContent
    const thoughts = thoughtResult.thoughts

    // Extract inlays and convert to multimodals
    const inlayResult = await extractInlays(formatedChat, msg.role, currentChar)
    formatedChat = inlayResult.cleanedContent
    let multimodals = inlayResult.multimodals

    // Process asset prompts
    const assetResult = await processAssetPrompts(formatedChat, currentChar)
    formatedChat = assetResult.cleanedContent
    multimodals = multimodals.concat(assetResult.multimodals)

    // Apply group formatting if needed
    const groupResult = applyGroupFormatting(formatedChat, msg, currentChar, options)
    formatedChat = groupResult.content
    const role = groupResult.role

    // Build the chat object
    const chat: OpenAIChat = {
        role: role,
        content: formatedChat,
        memo: msg.chatId,
        attr: [],
        multimodals: multimodals.length > 0 ? multimodals : undefined,
        thoughts: thoughts.length > 0 ? thoughts : undefined,
        encryptedThinking: (pastThinkingSend !== 0 && msg.encryptedThinking)
            ? msg.encryptedThinking.filter((et): et is { provider: string; data: any; tokens: number } =>
                et.tokens != null && et.tokens > 0)
            : undefined
    }

    // Clean up undefined/empty properties
    if (!chat.multimodals || chat.multimodals.length === 0) {
        delete chat.multimodals
    }
    if (!chat.thoughts || chat.thoughts.length === 0) {
        delete chat.thoughts
    }
    if (!chat.encryptedThinking || chat.encryptedThinking.length === 0) {
        delete chat.encryptedThinking
    }
    if (!chat.attr || chat.attr.length === 0) {
        delete chat.attr
    }

    // Calculate tokens
    let tokens = await tokenizer.tokenizeChat(chat)

    // Add thinking tokens for mode 1 (include in maxContext)
    if (pastThinkingSend === 1 && chat.encryptedThinking) {
        for (const et of chat.encryptedThinking) {
            tokens += et.tokens
        }
    }

    return { chat, tokens }
}

/**
 * Format entire chat history into OpenAIChat array
 */
export async function formatChatHistory(
    messages: Message[],
    options: FormatMessageOptions
): Promise<FormattedChatHistoryResult> {
    const chats: OpenAIChat[] = []
    let totalTokens = 0

    for (let i = 0; i < messages.length; i++) {
        const result = await formatSingleMessage(messages[i], i, messages.length, options)
        chats.push(result.chat)
        totalTokens += result.tokens
    }

    return { chats, totalTokens }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a character lookup cache function
 */
export function createCharacterCache(): (id: string) => character {
    const cache: { [key: string]: character } = {}

    return (id: string) => {
        if (cache[id]) {
            return cache[id]
        }
        const char = findCharacterbyId(id)
        cache[id] = char
        return char
    }
}

/**
 * Create format options from database state
 */
export function createFormatOptions(
    currentChar: character,
    nowChatroom: character | groupChat,
    tokenizer: ChatTokenizer,
    usingPromptTemplate: boolean,
    findCharacterbyIdWithCache: (id: string) => character
): FormatMessageOptions {
    return {
        currentChar,
        nowChatroom,
        tokenizer,
        usingPromptTemplate,
        sendName: usingPromptTemplate && DBState.db.promptSettings.sendName,
        isGroupChat: nowChatroom.type === 'group',
        pastThinkingSend: DBState.db.pastThinkingSend ?? 1,
        maxThoughtDepth: DBState.db.promptSettings?.maxThoughtTagDepth ?? -1,
        groupTemplate: DBState.db.groupTemplate || `<{{char}}'s Message>\n{{slot}}\n</{{char}}'s Message>`,
        groupOtherBotRole: DBState.db.groupOtherBotRole,
        findCharacterbyIdWithCache
    }
}
